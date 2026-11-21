# Nth Nota AI

A standalone Android assistant with two work surfaces. Chat holds a conversation. Desk holds editable notes, drafts and checklists that can outlive that conversation. A saved card carries its source links and opens the original thread while that thread exists. **Ask about this card** sends edits back through a new, reviewable draft.

Version 0.7.0 is a debug-signed testing build. Application ID `com.nth.notaai`. Minimum Android 8.0, target Android 16 / API 36. It can be installed alongside the Nth Nota notes app and the Nth Desktop launchers.

## Photos and screenshots

In Chat, tap the plus beside the message box and choose **Photo or screenshot**. Android’s share sheet can also send one image to Nota. Review the preview, then type or dictate a question. The image stays selected for follow-ups, including live voice. Tap the cross beside the thumbnail to return to ordinary chat. Tap a picture in the transcript to ask about it again.

When available, Android’s on-device Gemini Nano model answers from the pixels. The preview offers a model download on devices where Android reports it as downloadable. Otherwise, Nota reads Latin-script text and its approximate position with bundled ML Kit OCR. With cloud questions enabled, the default fallback sends the recognized lines, recent related exchanges and the question to the existing writing service. **Keep this analysis on my device** selects local processing. Answers identify which method was used. OCR can read a button label but cannot verify a button’s color or icon.

The image picker needs no library-wide permission. Nota keeps a resized, metadata-free copy in private app storage for regular chats. Temporary images stay in memory. Image replies are excluded from ordinary cloud chat context. One image is active per question, and each question retains its image reference.

The optional cloud image endpoint is implemented in `cloud/vision.mjs`. The Android preview offers full-image upload only after its capability check succeeds and cloud questions are enabled. The separate `nth-nota-vision` Worker uses an AI binding, the existing quota D1 database, a rate limiter and the free-only configuration. Its deployment does not change the text gateway.

## Live voice

Tap **Live** in Chat, then choose **Voice in Chat** for the transcript or **Live View** for the animated dot. Allow microphone access when prompted. Enable cloud questions for general AI conversations. Speak, pause, and listen to the reply. The microphone reopens after playback finishes. **Show chat** and **Live View** switch views of the same thread. **Mute mic** pauses capture. **Interrupt** cancels the current answer or stops its playback. **End voice**, typing, opening another screen, or leaving the app ends the session. Android speech recognition handles microphone input. Nota speaks with its bundled Kokoro Heart model. Android handles microphone audio and may use its online speech service. Nth Nota sends recognized text through the existing chat gateway. Draft text and text-file attachments are kept separate from spoken turns. An active image remains available for spoken follow-ups.

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
- Temporary conversations are held in memory. Saving a Desk card or exporting is an explicit action that creates a lasting copy. A selected text file or text shared by another app opens for review. Selected passages support up to 14,000 characters and use the gateway writing route. Follow-up chat can receive the writing result and question. The original passage is excluded from ordinary chat history sent to the model.
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
