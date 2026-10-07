import SwiftUI

enum BeckettColor {
    static let primary = Color(red: 186 / 255, green: 117 / 255, blue: 23 / 255)
    static let primaryDark = Color(red: 133 / 255, green: 79 / 255, blue: 11 / 255)
    static let primaryLight = Color(red: 250 / 255, green: 238 / 255, blue: 218 / 255)
    static let ink = Color(red: 26 / 255, green: 25 / 255, blue: 23 / 255)
    static let inkMid = Color(red: 74 / 255, green: 72 / 255, blue: 69 / 255)
    static let inkLight = Color(red: 138 / 255, green: 135 / 255, blue: 132 / 255)
    static let background = Color(red: 251 / 255, green: 248 / 255, blue: 243 / 255)
}

struct BeckettCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(BeckettColor.ink.opacity(0.09))
            }
    }
}

struct BeckettPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(BeckettColor.primary.opacity(configuration.isPressed ? 0.78 : 1), in: Capsule())
    }
}

extension View {
    func beckettPage() -> some View {
        self
            .foregroundStyle(BeckettColor.ink)
            .background(BeckettColor.background.ignoresSafeArea())
    }
}
