# Beckett Hackathon Video Shot List And Edit Guide

## Recording Setup

- Record at `1920x1080` if possible.
- Turn on Do Not Disturb.
- Hide bookmarks, extra tabs, and unrelated apps.
- Zoom Slack enough that message text is readable.
- Keep cursor movement slow and intentional.
- If Slack response generation takes time, keep recording and cut the wait in editing.

## Shot-By-Shot Timeline

| Time | Format | What To Show | Editing Notes |
| --- | --- | --- | --- |
| `0:00-0:10` | Live video | Slack thread already open with Jordan's message. | Start on the problem. No intro slide first. |
| `0:10-0:22` | Live video or static hold | Same Slack message, lightly zoomed/cropped if editing allows. | Pause long enough for judges to read it. |
| `0:22-0:30` | Word slide | `title-card.svg` or matching overlay. | Keep this short. Product name only, not a feature list. |
| `0:30-0:45` | Live video | Open the message actions menu and choose `Beckett - Decode`, `Beckett - Respond`, or the current live label. | Cut any menu fumbling. |
| `0:45-1:06` | Live video | Beckett's private response. Show visible facts and uncertainty. | If response is long, use a slow scroll. |
| `1:06-1:20` | Live video | Ask Beckett for a reply: `/beckett respond Help me reply to Jordan without sounding defensive...` | Cut slow typing; show the command already typed if needed. |
| `1:20-1:35` | Live video or static hold | Beckett's reply options. | This is a second proof moment before prep. |
| `1:35-1:45` | Live video or static hold | Keep the reply options visible while explaining user judgment/control. | This is the easiest place to trim if the final edit runs long. |
| `1:45-1:55` | Live video | Type `/beckett prep I need to talk to my manager about workload in my 1:1`. | If typing is slow, speed up or cut to the command already typed. |
| `1:55-2:15` | Live video | Beckett's guided prep flow asking focused questions. | Show one answer if useful, but do not spend too much time typing. |
| `2:15-2:42` | Live video | Final prep output: opening line, talking points, likely pushback, follow-up draft. | This is the second key proof moment. |
| `2:42-2:56` | Live video with optional small text overlay | Keep final prep output visible. | Personal inspiration is voiceover only. Stay on product. |
| `2:56-2:59` | Word slide | `closing-card.svg`. | End cleanly before 3 minutes. |

## What Is Video Vs Picture Vs Word Slide

- Use live video for all product proof: Slack thread, shortcut, Beckett response, slash command, guided prep, and final output.
- Use a static hold only when the viewer needs time to read a result.
- If the voiceover is short, extend the static hold on Beckett's first response and use the Slack/context-clues paragraph from the script.
- Use word slides only twice: the title card and closing card.
- Do not use personal photos unless you already have one ready and it does not distract from the product.
- Do not use architecture diagrams in the video. Put architecture in Devpost instead.

## Editing Assembly

1. Import `beckett-respond-demo.mov`, `beckett-prep-demo.mov`, and the two SVG cards into your editor.
2. If your editor does not accept SVG, open each SVG in a browser and export or screenshot it as a PNG.
3. Place clips in this order:
   - Jordan Slack thread
   - `title-card.svg`
   - Beckett message shortcut response
   - Beckett reply-drafting mini example
   - `/beckett prep` flow
   - final prep output hold
   - `closing-card.svg`
4. Add the voiceover as one continuous audio track.
5. Cut dead time, loading pauses, slow typing, and repeated scrolls.
6. Keep the final export under `3:00`.

## Quality Bar

- A judge should understand the problem by `0:15`.
- A judge should see Beckett working by `0:45`.
- A judge should see reply options by `1:35`.
- A judge should see conversation prep output by `2:42`.
- The last line should feel complete, not rushed.
