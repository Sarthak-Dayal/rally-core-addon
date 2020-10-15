/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = class DataCollection {
  /**
   * Sends an empty Ion ping with the provided info.
   *
   * @param {String} payloadType
   *        The type of the encrypted payload. This will define the
   *        `schemaName` of the ping.
   *
   * @param {String} namespace
   *        The namespace to route the ping. This will define the
   *        `schemaNamespace` and `studyName` properties of the ping.
   */
  async _sendEmptyPing(payloadType, namespace) {
    let options = {
      studyName: namespace,
      addPioneerId: true,
      // NOTE - while we're not actually sending useful data in
      // this payload, the current Ion v2 Telemetry pipeline requires
      // that pings are shaped this way so they are routed to the correct
      // environment.
      //
      // At the moment, the public key used here isn't important but we do
      // need to use *something*.
      encryptionKeyId: "discarded",
      publicKey: {
        crv: "P-256",
        kty: "EC",
        x: "XLkI3NaY3-AF2nRMspC63BT1u0Y3moXYSfss7VuQ0mk",
        y: "SB0KnIW-pqk85OIEYZenoNkEyOOp5GeWQhS1KeRtEUE",
      },
      schemaName: payloadType,
      schemaVersion: 1,
      // Note that the schema namespace directly informs how data is
      // segregated after ingestion.
      // If this is an enrollment ping for the pioneer program (in contrast
      // to the enrollment to a specific study), use a meta namespace.
      schemaNamespace: namespace,
    };

    // For enrollment, we expect to send an empty payload.
    const payload = {};

    // We intentionally don't wait on the promise returned by
    // `submitExternalPing`, because that's an internal API only meant
    // for telemetry tests. Moreover, in order to send a custom schema
    // name and a custom namespace, we need to ship a custom "experimental"
    // telemetry API for legacy telemetry.
    await browser.firefoxPrivilegedApi
      .submitEncryptedPing("pioneer-study", payload, options)
      .then(() => {
        console.debug(`IonCore._sendEnrollmentPing - options: ${JSON.stringify(options)} payload: ${JSON.stringify(payload)}`);
      })
      .catch(error => {
        console.error(`IonCore._sendEnrollmentPing failed - error: ${error}`);
      });
  }

  /**
   * Sends a Pioneer enrollment ping.
   *
   * The `creationDate` provided by the telemetry APIs will be used as the
   * timestamp for considering the user enrolled in pioneer and/or the study.
   *
   * @param {String} [studyAddonid=undefined]
   *        optional study id. It's sent in the ping, if present, to signal
   *        that user enroled in the study.
   */
  async sendEnrollmentPing(studyAddonId) {
    // If we were provided with a study id, then this is an enrollment to a study.
    // Send the id alongside with the data and change the schema namespace to simplify
    // the work on the ingestion pipeline.
    if (typeof studyAddonId != "undefined") {
      return await this._sendEmptyPing("pioneer-enrollment", studyAddonId);
    }

    // Note that the schema namespace directly informs how data is segregated after ingestion.
    // If this is an enrollment ping for the pioneer program (in contrast to the enrollment to
    // a specific study), use a meta namespace.
    return await this._sendEmptyPing("pioneer-enrollment", "pioneer-meta");
  }

  /**
   * Sends a Ion deletion-request ping.
   *
   * @param {String} studyAddonid
   *        It's sent in the ping to signal that user unenrolled from a study.
   */
  async sendDeletionPing(studyAddonId) {
    if (typeof studyAddonId === undefined) {
      throw new Error("IonCore - the deletion-request ping requires a study id");
    }

    return await this._sendEmptyPing("deletion-request", studyAddonId);
  }
};
