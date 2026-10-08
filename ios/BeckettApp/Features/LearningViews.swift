import SwiftUI

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
        difficulty: PracticeDifficulty
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
        !person.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
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
                difficulty: difficulty
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
        person = prefill.person.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "The sender"
            : prefill.person
        situation = "I received this message: \"\(prefill.originalMessage)\""
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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ContextModePicker(selection: $contextMode)
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
            Text("Practice a realistic text exchange before the real conversation.")
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
                    Text("Practicing with \(store.person)").font(.headline)
                    Text("\(store.difficulty.title) text conversation")
                        .font(.caption)
                        .foregroundStyle(BeckettColor.inkLight)
                }
                Spacer()
                Button("End") { Task { await finish() } }
                    .disabled(store.transcript.isEmpty || store.isWorking)
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
                                    Text(item.role == "user" ? "You" : store.person)
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

            TextField("What would you like to say?", text: $store.draft, axis: .vertical)
                .lineLimit(2...5)
                .padding(13)
                .background(BeckettColor.card, in: RoundedRectangle(cornerRadius: 14))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(BeckettColor.ink.opacity(0.1)) }

            HStack {
                Button("Start over") { store.startOver() }
                    .buttonStyle(.bordered)
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
        if await store.send(accessToken: token),
           let refreshed = await auth.refreshedAccessToken() {
            await store.send(accessToken: refreshed)
        }
    }

    private func finish() async {
        guard let token = auth.session?.accessToken else { return }
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
