import SwiftUI
import AVFoundation
import Speech

struct ContextModePicker: View {
    @Binding var selection: MobileContextMode

    var body: some View {
        Picker("Conversation context", selection: $selection) {
            ForEach(MobileContextMode.allCases) { mode in
                Text(mode.title).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityLabel("Personal or professional context")
    }
}

struct PracticePrefill: Equatable {
    let originalMessage: String
    let person: String
    let goal: String
    let conversationContext: String
}

private enum PracticeDifficulty: String, CaseIterable, Identifiable, Encodable {
    case realistic
    case supportive
    case challenging

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

private enum PracticeChannel: String, CaseIterable, Identifiable {
    case text
    case voice

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

@MainActor
private final class PracticeVoiceController: ObservableObject {
    @Published private(set) var isListening = false
    @Published var errorMessage: String?

    private let audioEngine = AVAudioEngine()
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    func toggleListening(onTranscript: @escaping (String) -> Void) async {
        if isListening {
            stopListening()
            return
        }
        guard await speechPermissionGranted(), await microphonePermissionGranted() else {
            errorMessage = "Allow microphone and speech recognition access in Settings to use Voice Practice."
            return
        }
        do {
            try startListening(onTranscript: onTranscript)
        } catch {
            errorMessage = "Voice Practice could not start listening. You can continue by typing."
        }
    }

    func speak(_ text: String) {
        stopListening()
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.48
        synthesizer.speak(utterance)
    }

    func stop() {
        stopListening()
        synthesizer.stopSpeaking(at: .immediate)
    }

    private func startListening(onTranscript: @escaping (String) -> Void) throws {
        errorMessage = nil
        synthesizer.stopSpeaking(at: .immediate)
        recognitionTask?.cancel()

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if speechRecognizer?.supportsOnDeviceRecognition == true {
            request.requiresOnDeviceRecognition = true
        }
        recognitionRequest = request

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        guard session.isInputAvailable else {
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw PracticeVoiceError.microphoneUnavailable
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else { throw PracticeVoiceError.microphoneUnavailable }
        inputNode.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
            request.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()
        isListening = true

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                if let result {
                    onTranscript(result.bestTranscription.formattedString)
                }
                if error != nil || result?.isFinal == true {
                    self?.stopListening()
                }
            }
        }
    }

    private func stopListening() {
        guard isListening else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        isListening = false
    }

    private func speechPermissionGranted() async -> Bool {
        if SFSpeechRecognizer.authorizationStatus() == .authorized { return true }
        let status = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        return status == .authorized
    }

    private func microphonePermissionGranted() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission {
                continuation.resume(returning: $0)
            }
        }
    }
}

private enum PracticeVoiceError: Error {
    case microphoneUnavailable
}

private struct PracticeRequest: Encodable {
    let operation: String
    let sessionId: String?
    let contextMode: MobileContextMode?
    let person: String?
    let situation: String?
    let goal: String?
    let concern: String?
    let relationshipContext: String?
    let personStyle: String?
    let constraints: String?
    let difficulty: PracticeDifficulty?
    let initialMessage: String?
    let message: String?

    static func start(
        contextMode: MobileContextMode,
        person: String,
        situation: String,
        goal: String,
        concern: String,
        relationshipContext: String,
        personStyle: String,
        constraints: String,
        difficulty: PracticeDifficulty,
        initialMessage: String
    ) -> Self {
        Self(
            operation: "start",
            sessionId: nil,
            contextMode: contextMode,
            person: person,
            situation: situation,
            goal: goal,
            concern: concern,
            relationshipContext: relationshipContext,
            personStyle: personStyle,
            constraints: constraints,
            difficulty: difficulty,
            initialMessage: initialMessage,
            message: nil
        )
    }

    static func action(_ operation: String, sessionId: String, message: String? = nil) -> Self {
        Self(
            operation: operation,
            sessionId: sessionId,
            contextMode: nil,
            person: nil,
            situation: nil,
            goal: nil,
            concern: nil,
            relationshipContext: nil,
            personStyle: nil,
            constraints: nil,
            difficulty: nil,
            initialMessage: nil,
            message: message
        )
    }
}

private struct PracticeTranscriptItem: Decodable, Identifiable {
    let role: String
    let content: String
    let turn: Int
    let createdAt: String

    var id: String { "\(turn)-\(role)-\(createdAt)" }
}

private struct PracticeAssessment: Decodable {
    let summary: String
    let whatWorked: [String]
    let goalProgress: String
}

private struct PracticeResponse: Decodable {
    let sessionId: String?
    let transcript: [PracticeTranscriptItem]?
    let conversationStatus: String?
    let endReason: String?
    let assessment: PracticeAssessment?
}

@MainActor
private final class PracticeStore: ObservableObject {
    @Published var person = ""
    @Published var situation = ""
    @Published var goal = ""
    @Published var concern = ""
    @Published var relationshipContext = ""
    @Published var personStyle = ""
    @Published var constraints = ""
    @Published var initialMessage = ""
    @Published var difficulty: PracticeDifficulty = .realistic
    @Published var draft = ""
    @Published private(set) var sessionId: String?
    @Published private(set) var transcript: [PracticeTranscriptItem] = []
    @Published private(set) var assessment: PracticeAssessment?
    @Published private(set) var endReason: String?
    @Published private(set) var isWorking = false
    @Published var errorMessage: String?

    private let api = APIClient()

    var canStart: Bool {
        !situation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func start(accessToken: String, contextMode: MobileContextMode) async -> Bool {
        await request(
            .start(
                contextMode: contextMode,
                person: person,
                situation: situation,
                goal: goal,
                concern: concern,
                relationshipContext: relationshipContext,
                personStyle: personStyle,
                constraints: constraints,
                difficulty: difficulty,
                initialMessage: initialMessage
            ),
            accessToken: accessToken
        ) { response in
            self.sessionId = response.sessionId
            self.transcript = response.transcript ?? []
            self.assessment = nil
            self.endReason = nil
        }
    }

    func send(accessToken: String) async -> Bool {
        guard let sessionId else { return false }
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return false }
        let original = draft
        draft = ""
        initialMessage = ""
        let unauthorized = await request(
            .action("turn", sessionId: sessionId, message: message),
            accessToken: accessToken
        ) { response in
            self.transcript = response.transcript ?? self.transcript
            self.endReason = response.endReason
        }
        if errorMessage != nil { draft = original }
        return unauthorized
    }

    func finish(accessToken: String) async -> Bool {
        guard let sessionId else { return false }
        return await request(
            .action("finish", sessionId: sessionId),
            accessToken: accessToken
        ) { response in
            self.assessment = response.assessment
        }
    }

    func startOver() {
        sessionId = nil
        transcript = []
        assessment = nil
        endReason = nil
        draft = ""
        errorMessage = nil
    }

    func apply(_ prefill: PracticePrefill) {
        startOver()
        person = prefill.person.trimmingCharacters(in: .whitespacesAndNewlines)
        initialMessage = prefill.originalMessage
        situation = "Responding to a message I received."
        goal = prefill.goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Practice a clear response that moves the conversation forward."
            : prefill.goal
        relationshipContext = prefill.conversationContext
    }

    private func request(
        _ body: PracticeRequest,
        accessToken: String,
        apply: (PracticeResponse) -> Void
    ) async -> Bool {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let response: PracticeResponse = try await api.send(
                "api/mobile/v1/practice",
                body: body,
                accessToken: accessToken
            )
            apply(response)
            return false
        } catch let APIError.server(status, message, _, _, _) {
            errorMessage = message
            return status == 401
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

struct PracticeView: View {
    @Binding var contextMode: MobileContextMode
    @Binding var prefill: PracticePrefill?
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var store = PracticeStore()
    @StateObject private var voice = PracticeVoiceController()
    @State private var channel: PracticeChannel = .text

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if store.sessionId == nil && store.assessment == nil {
                        ContextModePicker(selection: $contextMode)
                    }
                    if let assessment = store.assessment {
                        assessmentView(assessment)
                    } else if store.sessionId != nil {
                        conversationView
                    } else {
                        setupView
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .beckettBrandNavigation()
            .toolbar(.visible, for: .tabBar)
            .beckettPage()
            .onChange(of: prefill) { _, value in
                applyPrefill(value)
            }
            .onAppear {
                applyPrefill(prefill)
            }
            .onDisappear { voice.stop() }
        }
    }

    private func applyPrefill(_ value: PracticePrefill?) {
        guard let value else { return }
        store.apply(value)
        prefill = nil
    }

    private var setupView: some View {
        Group {
            Text(contextMode == .professional ? "Rehearse a work conversation" : "Rehearse a personal conversation")
                .font(.system(size: 27, weight: .regular, design: .serif))
            Text(channel == .voice
                ? "Speak naturally and hear the simulated person respond."
                : "Practice a realistic text exchange before the real conversation.")
                .font(.subheadline)
                .foregroundStyle(BeckettColor.inkMid)

            BeckettCard {
                VStack(alignment: .leading, spacing: 14) {
                    TextField("Who are you talking to?", text: $store.person)
                    Divider()
                    TextField("What is the situation?", text: $store.situation, axis: .vertical)
                    Divider()
                    TextField("What would a good outcome be?", text: $store.goal, axis: .vertical)
                    Divider()
                    TextField("What are you concerned about? (optional)", text: $store.concern, axis: .vertical)
                    DisclosureGroup("Add more context") {
                        VStack(spacing: 12) {
                            TextField("Relationship context", text: $store.relationshipContext, axis: .vertical)
                            TextField("Their communication style", text: $store.personStyle, axis: .vertical)
                            TextField("Constraints or pressure", text: $store.constraints, axis: .vertical)
                        }
                        .padding(.top, 10)
                    }
                }
            }

            Picker("Practice format", selection: $channel) {
                ForEach(PracticeChannel.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Text or voice practice")

            Picker("Simulation mode", selection: $store.difficulty) {
                ForEach(PracticeDifficulty.allCases) { difficulty in
                    Text(difficulty.title).tag(difficulty)
                }
            }
            .pickerStyle(.segmented)

            Button("Start Practice") {
                Task { await start() }
            }
            .buttonStyle(BeckettPrimaryButtonStyle())
            .disabled(!store.canStart || store.isWorking)

            statusView
        }
    }

    private var conversationView: some View {
        Group {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(practiceTitle).font(.headline)
                    Text("\(store.difficulty.title) \(channel.title.lowercased()) conversation")
                        .font(.caption)
                        .foregroundStyle(BeckettColor.inkLight)
                }
                Spacer()
                Button("End") { Task { await finish() } }
                    .disabled(!store.transcript.contains(where: { $0.role == "user" }) || store.isWorking)
            }

            BeckettCard {
                VStack(spacing: 14) {
                    if store.transcript.isEmpty {
                        Text("Start the conversation when you’re ready.")
                            .foregroundStyle(BeckettColor.inkLight)
                            .frame(maxWidth: .infinity, minHeight: 150)
                    } else {
                        ForEach(store.transcript) { item in
                            HStack {
                                if item.role == "user" { Spacer(minLength: 36) }
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.role == "user" ? "You" : conversationPartnerLabel)
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(BeckettColor.inkLight)
                                    Text(item.content)
                                }
                                .padding(12)
                                .background(
                                    item.role == "user" ? BeckettColor.primary : BeckettColor.primaryLight,
                                    in: RoundedRectangle(cornerRadius: 15, style: .continuous)
                                )
                                .foregroundStyle(item.role == "user" ? Color.white : BeckettColor.ink)
                                if item.role != "user" { Spacer(minLength: 36) }
                            }
                        }
                    }
                }
            }

            if let endReason = store.endReason {
                Text(endReason)
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
            }

            TextField(
                channel == .voice ? "Tap the microphone or type what you want to say" : "What would you like to say?",
                text: $store.draft,
                axis: .vertical
            )
                .lineLimit(2...5)
                .padding(13)
                .background(BeckettColor.card, in: RoundedRectangle(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(BeckettColor.ink.opacity(0.1)) }

            HStack {
                Button("Start over") {
                    voice.stop()
                    store.startOver()
                }
                    .buttonStyle(.bordered)
                if channel == .voice {
                    Button {
                        Task {
                            await voice.toggleListening { transcript in
                                store.draft = transcript
                            }
                        }
                    } label: {
                        Label(
                            voice.isListening ? "Stop listening" : "Speak",
                            systemImage: voice.isListening ? "stop.circle.fill" : "mic.fill"
                        )
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(voice.isListening ? .red : BeckettColor.primaryDark)
                    .disabled(store.isWorking)
                }
                Button(store.isWorking ? "Responding…" : "Send") {
                    Task { await send() }
                }
                .buttonStyle(.borderedProminent)
                .tint(BeckettColor.primary)
                .disabled(store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isWorking)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)

            statusView
        }
    }

    private var conversationPartnerLabel: String {
        let firstPart = store.person
            .split(separator: ",", maxSplits: 1)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return firstPart.isEmpty ? "Other person" : firstPart
    }

    private var practiceTitle: String {
        conversationPartnerLabel == "Other person"
            ? "Practice conversation"
            : "Practicing with \(conversationPartnerLabel)"
    }

    private func assessmentView(_ assessment: PracticeAssessment) -> some View {
        Group {
            Text("Practice debrief")
                .font(.system(size: 28, weight: .regular, design: .serif))
            BeckettCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text(assessment.summary)
                    if !assessment.whatWorked.isEmpty {
                        Text("What worked").font(.headline)
                        ForEach(assessment.whatWorked, id: \.self) { item in
                            Label(item, systemImage: "checkmark.circle")
                        }
                    }
                    Text("Goal progress").font(.headline)
                    Text(assessment.goalProgress).foregroundStyle(BeckettColor.inkMid)
                }
            }
            Button("Practice another conversation") { store.startOver() }
                .buttonStyle(BeckettPrimaryButtonStyle())
        }
    }

    @ViewBuilder
    private var statusView: some View {
        if store.isWorking {
            ProgressView("Beckett is preparing the conversation…")
        }
        if let error = store.errorMessage {
            Text(error).font(.footnote).foregroundStyle(.red)
        }
        if let error = voice.errorMessage {
            Text(error).font(.footnote).foregroundStyle(.red)
        }
    }

    private func start() async {
        guard let token = auth.session?.accessToken else { return }
        if await store.start(accessToken: token, contextMode: contextMode),
           let refreshed = await auth.refreshedAccessToken() {
            await store.start(accessToken: refreshed, contextMode: contextMode)
        }
    }

    private func send() async {
        guard let token = auth.session?.accessToken else { return }
        voice.stop()
        let previousTranscriptCount = store.transcript.count
        if await store.send(accessToken: token),
           let refreshed = await auth.refreshedAccessToken() {
            await store.send(accessToken: refreshed)
        }
        if channel == .voice,
           store.transcript.count > previousTranscriptCount,
           let reply = store.transcript.last(where: { $0.role != "user" })?.content {
            voice.speak(reply)
        }
    }

    private func finish() async {
        guard let token = auth.session?.accessToken else { return }
        voice.stop()
        if await store.finish(accessToken: token),
           let refreshed = await auth.refreshedAccessToken() {
            await store.finish(accessToken: refreshed)
        }
    }
}

private struct MobileCourseSummary: Decodable, Identifiable {
    let id: String
    let title: String
    let description: String
    let estimatedMinutes: Int
    let section: String
    let progressPercent: Int
    let completed: Bool
}

private struct CourseCatalogResponse: Decodable {
    let courses: [MobileCourseSummary]
}

private struct CourseRequest: Encodable {
    let operation: String
    let courseId: String
    let currentLessonIndex: Int?
    let progressPercent: Int?
    let completed: Bool?
}

private struct MobileCourseLesson: Decodable, Identifiable {
    let id: String
    let title: String
    let type: String
    let body: [String]
    let bullets: [String]
    let instruction: String?
    let prompt: String?
    let scenario: String?
    let sections: [MobileCourseSection]?
    let cards: [MobileCourseCard]?
    let steps: [MobileCourseStep]?
    let rounds: [MobileCourseRound]?
    let items: [MobileCourseItem]?
    let options: [MobileCourseChoice]?
    let fields: [MobileCourseField]?
    let pairs: [MobileCoursePair]?
    let comparison: MobileCourseComparison?
}

private struct MobileCourseSection: Decodable {
    let heading: String
    let bullets: [String]
    let examples: [String]
}

private struct MobileCourseCard: Decodable {
    let front: String
    let back: [String]
}

private struct MobileCourseStep: Decodable {
    let label: String
    let text: String
    let example: String?
}

private struct MobileCourseChoice: Decodable {
    let text: String
    let correct: Bool?
    let explanation: String?
}

private struct MobileCourseRound: Decodable {
    let scenario: String
    let question: String?
    let explanation: String?
    let options: [MobileCourseChoice]
}

private struct MobileCourseItem: Decodable {
    let text: String
    let correct: String?
    let explanation: String?
}

private struct MobileCourseField: Decodable {
    let key: String
    let label: String
    let placeholder: String?
    let options: [String]
    let multi: Bool
}

private struct MobileCoursePair: Decodable {
    let left: String
    let right: String
}

private struct MobileCourseComparisonItem: Decodable {
    let label: String
    let message: String
    let note: String
}

private struct MobileCourseComparison: Decodable {
    let good: MobileCourseComparisonItem
    let bad: MobileCourseComparisonItem
}

private struct MobileCourse: Decodable {
    let id: String
    let title: String
    let description: String
    let estimatedMinutes: Int
    let lessons: [MobileCourseLesson]
}

private struct CourseContentResponse: Decodable {
    let course: MobileCourse
}

private struct CourseProgressResponse: Decodable {
    let completed: Bool
    let progressPercent: Int
}

@MainActor
private final class CoursesStore: ObservableObject {
    @Published private(set) var courses: [MobileCourseSummary] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    private let api = APIClient()

    func load(accessToken: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response: CourseCatalogResponse = try await api.get(
                "api/mobile/v1/courses",
                accessToken: accessToken
            )
            courses = response.courses
            return false
        } catch let APIError.server(status, message, _, _, _) {
            errorMessage = message
            return status == 401
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

struct CoursesView: View {
    @Binding var contextMode: MobileContextMode
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var store = CoursesStore()

    private var visibleCourses: [MobileCourseSummary] {
        store.courses.filter {
            $0.section.caseInsensitiveCompare(contextMode.title) == .orderedSame
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ContextModePicker(selection: $contextMode)
                    Text(contextMode == .professional ? "Professional courses" : "Personal courses")
                        .font(.system(size: 28, weight: .regular, design: .serif))
                    Text("Short lessons and practical tools. Progress syncs with your Beckett account.")
                        .font(.subheadline)
                        .foregroundStyle(BeckettColor.inkMid)

                    if store.isLoading {
                        ProgressView("Loading courses…")
                    } else if visibleCourses.isEmpty {
                        BeckettCard {
                            Text("No \(contextMode.title.lowercased()) courses are available yet.")
                                .foregroundStyle(BeckettColor.inkMid)
                        }
                    } else {
                        ForEach(visibleCourses) { course in
                            NavigationLink {
                                CourseDetailView(summary: course)
                            } label: {
                                courseCard(course)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if let error = store.errorMessage {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(20)
            }
            .beckettBrandNavigation()
            .toolbar(.visible, for: .tabBar)
            .beckettPage()
            .task { await load() }
        }
    }

    private func courseCard(_ course: MobileCourseSummary) -> some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(course.title).font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(BeckettColor.inkLight)
                }
                Text(course.description)
                    .font(.subheadline)
                    .foregroundStyle(BeckettColor.inkMid)
                HStack {
                    Label("\(course.estimatedMinutes) min", systemImage: "clock")
                    Spacer()
                    Text(course.completed ? "Completed" : course.progressPercent > 0 ? "\(course.progressPercent)% complete" : "Start course")
                }
                .font(.caption)
                .foregroundStyle(course.completed ? Color.green : BeckettColor.primaryDark)
            }
        }
    }

    private func load() async {
        guard let token = auth.session?.accessToken else { return }
        if await store.load(accessToken: token),
           let refreshed = await auth.refreshedAccessToken() {
            await store.load(accessToken: refreshed)
        }
    }
}

private struct CourseInteractiveLessonView: View {
    let lesson: MobileCourseLesson
    @State private var revealedCards: Set<Int> = []
    @State private var selectedChoices: [String: Set<Int>] = [:]
    @State private var fieldValues: [String: String] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let instruction = lesson.instruction, !instruction.isEmpty {
                Label(instruction, systemImage: "hand.tap")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(BeckettColor.primaryDark)
            }
            if let scenario = lesson.scenario, !scenario.isEmpty {
                Text(scenario)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BeckettColor.primaryLight, in: RoundedRectangle(cornerRadius: 12))
            }
            if let prompt = lesson.prompt, !prompt.isEmpty {
                Text(prompt).font(.headline)
            }

            ForEach(Array((lesson.sections ?? []).enumerated()), id: \.offset) { _, section in
                if lesson.type == "accordion" {
                    DisclosureGroup(section.heading) {
                        nestedContent(section.bullets, examples: section.examples)
                            .padding(.top, 8)
                    }
                    .font(.headline)
                    .tint(BeckettColor.primaryDark)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(section.heading).font(.headline)
                        nestedContent(section.bullets, examples: section.examples)
                    }
                }
            }

            ForEach(Array((lesson.cards ?? []).enumerated()), id: \.offset) { index, card in
                Button {
                    if revealedCards.contains(index) { revealedCards.remove(index) }
                    else { revealedCards.insert(index) }
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(card.front).font(.headline)
                            Spacer()
                            Image(systemName: revealedCards.contains(index) ? "chevron.up" : "arrow.triangle.2.circlepath")
                        }
                        if revealedCards.contains(index) {
                            nestedContent(card.back, examples: [])
                        } else {
                            Text("Tap to reveal")
                                .font(.caption)
                                .foregroundStyle(BeckettColor.inkLight)
                        }
                    }
                    .padding(13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BeckettColor.primaryLight, in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
            }

            ForEach(Array((lesson.steps ?? []).enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 10) {
                    Text("\(index + 1)")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 25, height: 25)
                        .background(BeckettColor.primary, in: Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text(step.label).font(.headline)
                        Text(step.text)
                        if let example = step.example {
                            Text(example).font(.footnote).foregroundStyle(BeckettColor.inkMid)
                        }
                    }
                }
            }

            ForEach(Array((lesson.rounds ?? []).enumerated()), id: \.offset) { roundIndex, round in
                roundView(round, index: roundIndex)
            }

            ForEach(Array((lesson.items ?? []).enumerated()), id: \.offset) { index, item in
                choiceButton(
                    text: item.text,
                    key: "item-\(index)",
                    index: 0,
                    allowsMultiple: lesson.type == "checklist",
                    feedback: [item.correct.map { "Expected: \($0)" }, item.explanation]
                        .compactMap { $0 }.joined(separator: " — ")
                )
            }

            if !(lesson.options ?? []).isEmpty {
                ForEach(Array((lesson.options ?? []).enumerated()), id: \.offset) { index, option in
                    choiceButton(
                        text: option.text,
                        key: "lesson-options",
                        index: index,
                        allowsMultiple: true,
                        feedback: option.explanation ?? ""
                    )
                }
            }

            ForEach(Array((lesson.pairs ?? []).enumerated()), id: \.offset) { index, pair in
                DisclosureGroup(pair.left) {
                    Text(pair.right)
                        .padding(.top, 8)
                        .foregroundStyle(BeckettColor.inkMid)
                }
                .tint(BeckettColor.primaryDark)
                .accessibilityHint("Reveal the matching answer")
            }

            if let comparison = lesson.comparison {
                comparisonCard(comparison.good, systemImage: "checkmark.circle.fill", color: .green)
                comparisonCard(comparison.bad, systemImage: "exclamationmark.circle.fill", color: BeckettColor.primary)
            }

            ForEach(lesson.fields ?? [], id: \.key) { field in
                VStack(alignment: .leading, spacing: 8) {
                    Text(field.label).font(.headline)
                    if field.options.isEmpty {
                        TextField(field.placeholder ?? "Type your answer", text: fieldBinding(field.key), axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 7) {
                                ForEach(field.options, id: \.self) { option in
                                    Button(option) {
                                        fieldValues[field.key] = option
                                    }
                                    .buttonStyle(.bordered)
                                    .buttonBorderShape(.capsule)
                                    .tint(fieldValues[field.key] == option ? BeckettColor.primary : BeckettColor.primaryDark)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func fieldBinding(_ key: String) -> Binding<String> {
        Binding(
            get: { fieldValues[key] ?? "" },
            set: { fieldValues[key] = $0 }
        )
    }

    private func roundView(_ round: MobileCourseRound, index: Int) -> some View {
        let key = "round-\(index)"
        return VStack(alignment: .leading, spacing: 9) {
            if !round.scenario.isEmpty { Text(round.scenario).font(.headline) }
            if let question = round.question { Text(question).foregroundStyle(BeckettColor.inkMid) }
            ForEach(Array(round.options.enumerated()), id: \.offset) { optionIndex, option in
                choiceButton(
                    text: option.text,
                    key: key,
                    index: optionIndex,
                    allowsMultiple: lesson.type == "multi-select-quiz",
                    feedback: option.explanation ?? round.explanation ?? ""
                )
                if selectedChoices[key]?.contains(optionIndex) == true, let correct = option.correct {
                    Label(correct ? "That fits" : "Try another option", systemImage: correct ? "checkmark.circle" : "arrow.counterclockwise.circle")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(correct ? Color.green : BeckettColor.primaryDark)
                }
            }
        }
    }

    private func choiceButton(
        text: String,
        key: String,
        index: Int,
        allowsMultiple: Bool,
        feedback: String
    ) -> some View {
        let selected = selectedChoices[key]?.contains(index) == true
        return VStack(alignment: .leading, spacing: 5) {
            Button {
                var values = selectedChoices[key] ?? []
                if allowsMultiple {
                    if values.contains(index) { values.remove(index) } else { values.insert(index) }
                } else {
                    values = [index]
                }
                selectedChoices[key] = values
            } label: {
                HStack {
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    Text(text).multilineTextAlignment(.leading)
                    Spacer()
                }
                .padding(11)
                .background(selected ? BeckettColor.primaryLight : BeckettColor.background, in: RoundedRectangle(cornerRadius: 11))
            }
            .buttonStyle(.plain)
            if selected, !feedback.isEmpty {
                Text(feedback).font(.footnote).foregroundStyle(BeckettColor.inkMid).padding(.leading, 12)
            }
        }
    }

    private func nestedContent(_ bullets: [String], examples: [String]) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(bullets, id: \.self) { bullet in
                HStack(alignment: .top, spacing: 8) {
                    Circle().fill(BeckettColor.primary).frame(width: 5, height: 5).padding(.top, 7)
                    Text(bullet).font(.body)
                }
            }
            ForEach(examples, id: \.self) { example in
                Text(example)
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
                    .padding(.leading, 13)
            }
        }
    }

    private func comparisonCard(_ item: MobileCourseComparisonItem, systemImage: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(item.label, systemImage: systemImage).font(.headline).foregroundStyle(color)
            Text(item.message)
            Text(item.note).font(.footnote).foregroundStyle(BeckettColor.inkMid)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BeckettColor.background, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct CourseDetailView: View {
    let summary: MobileCourseSummary
    @EnvironmentObject private var auth: AuthStore
    @State private var course: MobileCourse?
    @State private var lessonIndex = 0
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var completed = false
    private let api = APIClient()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let course, !course.lessons.isEmpty {
                    ProgressView(
                        value: Double(lessonIndex + 1),
                        total: Double(course.lessons.count)
                    )
                    Text("Lesson \(lessonIndex + 1) of \(course.lessons.count)")
                        .font(.caption)
                        .foregroundStyle(BeckettColor.inkLight)
                    lessonView(course.lessons[lessonIndex])

                    HStack {
                        Button("Previous") {
                            lessonIndex = max(0, lessonIndex - 1)
                            Task { await saveProgress(completed: false) }
                        }
                        .buttonStyle(.bordered)
                        .disabled(lessonIndex == 0 || isWorking)

                        Spacer()

                        if lessonIndex == course.lessons.count - 1 {
                            Button(completed ? "Completed" : "Complete course") {
                                Task { await saveProgress(completed: true) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(BeckettColor.primary)
                            .disabled(completed || isWorking)
                        } else {
                            Button("Next") {
                                lessonIndex += 1
                                Task { await saveProgress(completed: false) }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(BeckettColor.primary)
                            .disabled(isWorking)
                        }
                    }
                } else if isWorking {
                    ProgressView("Loading course…")
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding(20)
        }
        .navigationTitle(summary.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .tabBar)
        .beckettPage()
        .task { await loadContent() }
    }

    private func lessonView(_ lesson: MobileCourseLesson) -> some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 14) {
                Text(lesson.title)
                    .font(.system(size: 24, weight: .regular, design: .serif))
                ForEach(Array(lesson.body.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .foregroundStyle(BeckettColor.inkMid)
                }
                ForEach(Array(lesson.bullets.enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .top, spacing: 9) {
                        Circle()
                            .fill(BeckettColor.primary)
                            .frame(width: 5, height: 5)
                            .padding(.top, 7)
                        Text(bullet)
                    }
                }
                CourseInteractiveLessonView(lesson: lesson)
            }
        }
    }

    private func loadContent() async {
        guard let token = auth.session?.accessToken else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let response: CourseContentResponse = try await api.send(
                "api/mobile/v1/courses",
                body: CourseRequest(
                    operation: "content",
                    courseId: summary.id,
                    currentLessonIndex: nil,
                    progressPercent: nil,
                    completed: nil
                ),
                accessToken: token
            )
            course = response.course
            completed = summary.completed
            if !response.course.lessons.isEmpty {
                lessonIndex = min(
                    response.course.lessons.count - 1,
                    max(0, Int(Double(summary.progressPercent) / 100 * Double(response.course.lessons.count)))
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveProgress(completed: Bool) async {
        guard let token = auth.session?.accessToken, let course else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        let percent = completed
            ? 100
            : min(99, Int(Double(lessonIndex + 1) / Double(course.lessons.count) * 100))
        do {
            let response: CourseProgressResponse = try await api.send(
                "api/mobile/v1/courses",
                body: CourseRequest(
                    operation: "progress",
                    courseId: course.id,
                    currentLessonIndex: lessonIndex,
                    progressPercent: percent,
                    completed: completed
                ),
                accessToken: token
            )
            self.completed = response.completed
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
