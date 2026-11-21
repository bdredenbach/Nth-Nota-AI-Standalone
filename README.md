# Nth Nota AI

A standalone Android assistant with two work surfaces. Chat holds a conversation. Desk holds editable notes, drafts and checklists that can outlive that conversation. A saved card carries its source links and opens the original thread while that thread exists. **Ask about this card** sends edits back through a new, reviewable draft.

Version 0.10.0 is a debug-signed testing build. Application ID `com.nth.notaai`. Minimum Android 8.0, target Android 16 / API 36. It can be installed alongside the Nth Nota notes app and the Nth Desktop launchers.

## Organizing chats and Desk cards

Open the menu at the top left to search saved chats, Desk cards and project names. Search runs on the device and includes chat messages, card text and attachment names. Pinned items appear above recent chats. Use the options beside an item to pin, rename or move it.

Open **Projects** to create a project. Inside it, use **New chat** or **Add existing**. Cards saved from a project chat and branches from that chat start in the same project. Each item can be moved individually. Removing a project keeps its contents in All chats and Desk. Temporary conversations stay outside search and projects. Project membership does not add other chats to a model request.

## Files and versions

Open **Menu → Files** for reusable uploads, replies saved as files and Markdown exports. A private on-device SQLite database stores metadata and original document bytes together. Photos keep Nota’s resized, metadata-free JPEG. Files stay available after closing or deleting their source chat. Temporary uploads stay in their temporary chat. Saving a reply from a temporary chat creates a lasting copy by explicit choice. Removing a saved file deletes its version history, while previous chat excerpts and downloaded copies remain.

Upload a ZIP containing a Markdown file and ask to revise it, or choose **Revise with Nota** on its file page. Select the member if several are eligible. Review the replacement text and tap **Save new version**. Nota writes a new ZIP containing the edited text and the other original members. The earlier version stays available. Text revision supports complete UTF-8 entries up to 12,000 characters. Downloads include the selected version’s full bytes.

To compare, select a version, tap **Compare files or versions**, choose the other version and attach the comparison in this chat or a new one. **Compare with a saved chat** uses the chosen file preview and excerpts from up to five recent completed exchanges. Nothing is sent until you send the question. You can also mention an exact filename in a question, such as “Compare v1 and v2 of plan.zip.” Explicit requests for a downloadable Markdown file produce a reusable document. Other replies can be saved from their action menu. Re-exporting a changed Desk card or chat creates another version of that export.

On upgrade, opening Files imports earlier regular-chat photos that are still present and the text previews that older builds retained. These older document copies are labeled with the suffix .preview.md.

## Chat attachments

Tap **+** and choose **Camera**, **Photos** or **Files**. The selection appears beside your question. Tap it for a closer look, or tap **×** to remove it. Sending without typing asks Nota to describe the photo or summarize the file. The attachment stays selected for follow-up questions, including live voice. An attachment in a previous message can be reopened.

With cloud questions enabled, Nota asks once whether to analyze photos online or keep them on the phone. Change this under **Settings → Photo analysis**. Online analysis sends the photo, question and recent exchanges about that photo to the vision Worker. With cloud questions off, photos are processed locally. On-device analysis uses Android’s vision model when available or reads screenshot text locally. Settings offers a model download on supported devices. Regular chats keep a resized photo in private storage. Temporary chats hold the resized photo in memory.

Files accepts ZIP archives up to 16 MB and UTF-8 text, including TXT, Markdown, CSV, JSON and logs. Nota prepares a preview on the phone. For ZIPs it lists up to 60 entries, then includes text excerpts that fit in the preview. Binary and nested archives appear by name. An attached file question shares the preview text, file name and recent discussion of that file with the existing writing service. The original ZIP is never uploaded. Tap the file in the composer to see the text that will be sent.

## Live voice

Tap **Live** in Chat, then choose **Voice in Chat** for the transcript or **Live View** for the animated dot. Allow microphone access when prompted. Enable cloud questions for general AI conversations. Speak, pause, and listen to the reply. The microphone reopens after playback finishes. **Show chat** and **Live View** switch views of the same thread. **Mute mic** pauses capture. **Interrupt** cancels the current answer or stops its playback. **End voice**, typing, opening another screen, or leaving the app ends the session. Android speech recognition handles microphone input. Nota speaks with its bundled Kokoro Heart model. Android handles microphone audio and may use its online speech service. Nth Nota sends recognized text through the existing chat gateway. Unsent draft text and pasted passages stay separate from spoken turns. An active photo or file stays available for spoken follow-ups.

## Rehearsals, phrases and predictions

Open the **New conversation** menu for **Rehearsal room**, **My phrases**, or **Call it now**. Desk’s create menu also offers phrases and predictions.

- **Rehearsal room** lets you choose a partner and a situation, then practice by text or live voice. **Rewind one exchange** keeps the old take available for review. The next reply uses the active dialogue. **Coach me** asks the existing writing service for feedback. A coaching quote links back only when it matches the speaker’s actual words.
- **My phrases** saves a trigger, an optional opening question and a list of steps. Describe a routine or write the steps yourself. You can copy and edit a Desk checklist. Say or type the saved phrase in a regular chat to start a fresh checklist. Answers and step observations stay on that run. Templates and runs are stored on the device.
- **Call it now** records a prediction, a result that would change your mind and the time. In Live, Nota asks for the missing information aloud. Reopen the Prediction card on Desk to add a dated observation and verdict. Later observations appear beside the original prediction, which remains available for comparison and Markdown export.

## Conversation and Desk tools

- **Hold that thought** saves the last sentence Android recognized as a Desk note. Add the phrase at the end of an utterance or say it on the next turn. A system click acknowledges the save when touch sounds are enabled. **Go to spoken line** opens the original regular chat and highlights the quote. A note explicitly pinned from a temporary chat keeps the quote.
- **Let me ramble** keeps listening across pauses while Nota is open. Each completed passage appears in the transcript. Say **I’m done** for a short recap in your own words, then choose an idea to explore. A regular chat can resume a partially captured ramble after reopening.
- **Leave it here** saves an editable bookmark with a next question. Reopening the chat shows both fields. Starting live voice in that chat reads them aloud. Temporary bookmarks last for the current temporary conversation.
- **Walk me through it** opens from a Desk checklist and reads the next unchecked step. Say **done**, **repeat**, or **I found a problem**. You can also say “Step two failed. The folder closed.” Observations are stored beside the relevant step and included in Markdown export. Leaving Nota stops the microphone and retains completed steps.
- **Change just that** opens on a Desk draft or note. Select a paragraph or highlight text, type or dictate an instruction, then preview the proposed replacement. Select **Keep my last sentence exactly** to protect the closing sentence. Only the editable passage and instruction go to the existing writing service. You can keep the original, apply the edit, or undo the last accepted edit after reopening the card.

## Phone setup

First launch or upgrade offers three optional steps. Reopen them under **Settings → Phone setup**. The back and next controls let you return from Android special-access screens and check the actual grants. Changing phone settings or opening an app requires tapping its shortcut.

- Weather can follow approximate foreground location, use a saved city or ZIP, or look up a place named in a question. Android resolves typed places. Nota sends coordinates rounded to two decimal places to MET Norway and credits the forecast source. An unavailable location falls back to the saved place, then offers setup. MET Norway supplies hourly forecasts, including the current hour. Dates use the phone time zone. Temperature units follow the device region.
- Usage Access is optional and is used for the recent launchable apps from this phone profile in the last 24 hours. App shortcuts, Android settings, battery, storage and model/version questions work without Usage Access. Phone lookup results are excluded from subsequent AI conversation context.
- Live voice can handle phone commands with cloud questions off. Android's microphone/recognition settings still apply. General AI questions use the existing cloud consent switch.

## Built-in voice

**Settings → Speaking voice → Preview voice** plays the same Heart engine used for live replies and read-aloud. Heart is American English and defaults to 90% speed. The pace slider covers 75% through 110% in 5-point increments. Select Android voice to use the system engine, including other installed languages. These choices apply to Nota only and persist across restarts.

The APK contains the full Kokoro-82M LiteRT CPU model compressed in its assets. First playback expands the model into the app’s private storage (approximately 295 MB of additional space). The bundled voice can read text and play its preview with cloud questions turned off. Chat continues to use the existing Nth Nota gateway. Audio is synthesized and played on the device through MediaPipe Audio Tasks 1.2.3. Model attribution, the model checksum, and the Apache 2.0 license ship under `app/src/main/res/raw`.

## Try it

1. Choose **Make a plan** and the sketchbook packing prompt. Tap Send, read the cloud consent prompt, allow it, then tap Send again.
2. Tap **To Desk → Checklist** on the answer. Rename it, edit a line and check an item. Return via the Desk tab to find it again.
3. Tap **Original conversation → Second look → Find the weak spot**. Review and send the follow-up. Both conversations remain available in History.
4. Try a source question in **Web search** mode. The app displays the links the gateway returns. If the gateway cannot substantiate an answer, it displays that outcome and offers a manual browser search.
5. Chat and Desk item menus support Markdown export and Android sharing. Use the top-right Settings control for cloud consent and appearance. The new-chat button also offers temporary chats.

## Build and run

Open the project root in Android Studio. Install the Android SDK Platform 36 and use a JDK with Java 17 or later. The wrapper pins Gradle 8.13. On macOS or Linux run `./gradlew :app:assembleDebug :app:lintDebug`. On Windows run `.\gradlew.bat :app:assembleDebug :app:lintDebug`. The build produces `app/build/outputs/apk/debug/app-debug.apk`. Run the JavaScript checks with `node --test`. The first build downloads the pinned 295 MB Kokoro model from Hugging Face. Gradle caches the weights, verifies their SHA-256, and packages the voice inside the APK. Subsequent builds can use Gradle’s offline mode once all dependencies are cached.

Android Studio signs local debug builds with its own debug key. Updates over a previous install require the same signing certificate.

## Implementation

- The installed app bundles the interface, original artwork, fonts and local editor. A native Android bridge supplies private local persistence, on-device speech synthesis, the system file chooser, Markdown export and Android sharing. The app declares Internet and requests microphone permission when you start live voice. A current Android System WebView is required.
- Each regular conversation keeps its own draft and completed turns. A cloud request uses up to six completed exchanges and 9,000 characters of recent context. Canceled and unavailable replies are excluded. Source links come from gateway metadata. Model output is rendered as escaped text with support for Markdown lists, code blocks, quotes and tables.
- Temporary conversations are held in memory. Saving a Desk card or exporting is an explicit action that creates a lasting copy. Long text pasted into the composer or text shared by another app opens for review. Selected passages support up to 14,000 characters and use the gateway writing route. Follow-up chat can receive the writing result and question. The original passage is excluded from ordinary chat history sent to the model.
- Desk cards and regular conversations stay on the device. Deleting a chat preserves any separately saved cards. Switching off cloud access invalidates an in-flight reply. Data already transmitted to the service may already be processing.
- The Android client speaks only to the existing Nth Nota service for inference. For text inference it posts consented requests to `/v1/chat` or `/v1/write` at `https://nth-nota-free-ai.bdredenbach.workers.dev`. Cloudflare and Groq are selected server-side. API keys, paid model routing and provider account configuration belong on the server.
- Device dictation and optional Android voice depend on the installed Android speech services. Local storage, history, Desk editing and Markdown export are available without a cloud request.

## Product direction

| Area | In this testing build | Next milestone |
| --- | --- | --- |
| Conversation | Multi-turn chat, exact stop/retry, edit as a branch, searchable local history, temporary chat | Streaming replies when supported by the Worker, optional project context and explicitly editable memory |
| Thinking through an answer | Second look creates a branch to test an assumption, consider the opposing view or choose one next step | Compare two model answers side by side when a model selector and budget are available |
| Research | Automatic or explicit web search, requested-page reading via the gateway, source links and an honest unavailable state | A research notebook with a source attached to each claim, broader retrieval quality tests and multi-step reports |
| Working with material | Screenshot and photo questions, UTF-8 text imports, Android sharing, local notes, drafts, checklists and Markdown export | PDF understanding, structured spreadsheet analysis and charts |
| Voice and media | Voice in Chat and Live View, automatic turn taking, manual interruption, bundled Kokoro Heart, adjustable pace and dictation | Spoken interruption while Nota is talking, camera input, image creation and editing |
| Work organization | Local history and Desk, searchable cards, return to source conversation | Projects with files and custom assistant instructions, optional encrypted sync and backup |
| Connected tools | System document picker, share sheet and external source browser | User-selected connectors and scheduled tasks with clear permissions and execution records |
| Provider expansion | Existing shared testing gateway with server-side provider fallback | Capability-aware model selection and per-request cost controls before enabling paid providers |

The longer-term feature inventory draws on the public product guides for [ChatGPT](https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview), [Claude artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them), [Gemini Deep Research](https://support.google.com/gemini/answer/15719111) and [Grok](https://help.x.com/en/using-x/about-grok).

Font licenses ship in `app/src/main/res/raw`. No provider credentials or signing keys are included.
