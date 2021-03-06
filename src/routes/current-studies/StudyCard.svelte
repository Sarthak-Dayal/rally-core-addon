<script context=module>
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 // ^^^ the linter currently forces this block even though it appears below.
 // see https://github.com/mozilla-rally/core-addon/issues/184.
import { writable, get } from 'svelte/store';
import irb from "../irbs/";
import IRBWindow from "../irbs/IRBWindow.svelte";

let notificationID = writable(undefined);
let whichNotification = writable(false);
let activeKey = writable(undefined);

let firstRuns = {};

 function showNotification(joinOrLeave, key) {
    // absorb first run calls of showNotification.
    // This enables future reactive updates to trigger.
    if (!(key in firstRuns)) {
        firstRuns[key] = true;
    } else {
        const nid = get(notificationID);
        activeKey.set(key);
        whichNotification.set(joinOrLeave);
        if (nid) {
            clearTimeout(get(notificationID));
            notificationID.set(undefined);
        }
        notificationID.set(setTimeout(() => {
            activeKey.set(undefined);
            whichNotification.set(undefined);
            notificationID.set(undefined);
        }, 3000));
    }
}

</script>

<script> 
 /* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/* 
    NOTE: this is a full pattern integration of the study card. It uses the StudyCard, StudyCardHeader,
    and dialog components. This is the component to use _in practice_.

    It relies on props instead of slots to reduce the cost of use.
*/

import { createEventDispatcher } from 'svelte';
import StudyCard from '../../components/study-card/StudyCard.svelte';
import StudyCardHeader from '../../components/study-card/Header.svelte';
import Button from '../../components/Button.svelte';
import Dialog from '../../components/Dialog.svelte';
import SuccessfullyJoinedStudyNotification from './SuccessfullyJoinedStudyNotification.svelte';
import SuccessfullyLeftStudyNotification from './SuccessfullyLeftStudyNotification.svelte';

export let joined = false;
export let imageSrc;
export let title = "Untitled Study";
export let author = "Author Unknown";
export let description = "no description.";
export let endDate;
export let joinedDate;
export let dataCollectionDetails;
export let privacyPolicyLink;
export let tags;
export let detailsDirectName;
export let detailsDirectLink;
export let sidebarOffset = false; // sidebar offset for notifications

const dispatch = createEventDispatcher();

const key =
    `modal-${Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)}`;

let joinModal = false;

function triggerJoinEvent() {
    // send CTA click event to parent.
    dispatch('cta-clicked');
    joinModal = true;
}

// when the joined part changes, do something.
$: showNotification(joined, key);
$: isActive = $activeKey !== undefined && $activeKey === key;

</script>

<StudyCard
    {joined}
    on:join={triggerJoinEvent}
    on:leave={triggerJoinEvent}
    {endDate}
    {joinedDate}
    {dataCollectionDetails}
    {tags}
    {imageSrc}
    {privacyPolicyLink}>
        <span slot="name">{title}</span>
        <span slot="author">{author}</span>
        <p slot="description">
        {description}
        </p>
        <div slot="details" style="display: {(detailsDirectName !== undefined && detailsDirectLink !== undefined) ? 'auto' : 'none'};">
        {#if detailsDirectName && detailsDirectLink}
            Full study details can be found on the
            <a href={detailsDirectLink}>{detailsDirectName}</a>
        {/if}
        </div>
</StudyCard>

{#if joinModal}
    <Dialog
    height={joined ? undefined : "80vh"}
    topPadding={joined ? undefined : "calc(10vh - 20px)"}
    width={joined ? "var(--content-width)" : undefined}
    on:dismiss={() => {
        joinModal = false;
    }}>
    <!-- override the dialog Zilla font setting. -->
    <div slot="title">
        {#if !joined}
        <StudyCardHeader {endDate}>
            <img
            slot="study-icon"
            class="study-card-image"
            width="60"
            alt="study icon"
            src={imageSrc || "img/default-study-icon.png"} />
            <span slot="study-name">{title}</span>
            <span slot="study-author">{author}</span>
        </StudyCardHeader>
        {:else}Leave this Study?{/if}
    </div>
    <div class:split-content-modal={joined} slot="body">
        {#if !joined}
            <!-- Bake in the Princeton IRB. Once we have more studies, we will key this
                 by the study id.
            -->
            <IRBWindow>
                <svelte:component this={irb['princeton-study']} />
            </IRBWindow>
        {:else}
                <div style="width: 368px;">
                    <p style="padding-top: 20px;">
                        You’re free to come and go as you please. Just to confirm, leaving a study means the following:
                    </p>
                    <ul  class="mzp-u-list-styled bigger-gap" style="padding-right: 48px;">
                        <li><b>You will only be leaving this specific study</b>.
                            If you are enrolled in other studies, data
                            collection will proceed as planned.
                        </li>
                        <li>
                            Researchers working on this study will <b>no longer receive data from you</b>, 
                            and we will <b>delete any study data that we’ve collected from you</b> to date.
                        </li>
                    </ul>
                </div>
                    <img style="width: 270px; padding-top: 20px; transform: translateX(-24px);" src="img/leave-this-study.png" alt="person considering leaving the study" />
        {/if}
    </div>
    <!-- if the leave study modal is present, shore up the button hheights -->
    <div class='modal-call-flow' slot="cta" style={`margin-top: ${joined ? "-50px" : "none"};`}>
        <Button
        size="lg"
        product
        leave={joined}
        on:click={() => {
            // send join event to parent.
            dispatch(!joined ? "join" : "leave");
            joinModal = false;
        }}>
        {#if joined}Leave Study{:else}Accept & Enroll{/if}
        </Button>
        <Button
        size="lg"
        product
        secondary
        on:click={() => {
            joinModal = false;
        }}>
        Cancel
        </Button>
    </div>
    </Dialog>
{/if}

<!-- 
    this simple notification system should suffice for GTM.
    The component context controls whether or not any study cards
    show a notification. If a study card status changes (joined / unjoined)
    then all other notifications are removed, leaving room for the newly-changed
    study card to have its notification visible.

    NOTE: There is an edge case where I cannot get this notification to hide when attempting
    to suppress it when joinModal = true. From a UX point of view it should be fine enough,
    but leaving this note here to investigate if this is a Svelte edge case or otherwise.
 -->
{#if isActive && $notificationID !== undefined}
    {#key $notificationID}
        {#if $whichNotification === true}
        <SuccessfullyJoinedStudyNotification 
            location={sidebarOffset ? "top-left" : "top"}
            xOffset={sidebarOffset ? "var(--main-notification-offset)" : undefined } />
        {:else}
        <SuccessfullyLeftStudyNotification
            location={sidebarOffset ? "top-left" : "top"}
            xOffset={sidebarOffset ? "var(--main-notification-offset)" : undefined }
            />
        {/if}
    {/key}
{/if}
