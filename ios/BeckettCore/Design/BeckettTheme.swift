import SwiftUI
import UIKit

enum BeckettColor {
    static let primary = Color(red: 186 / 255, green: 117 / 255, blue: 23 / 255)
    static let primaryDark = Color(red: 133 / 255, green: 79 / 255, blue: 11 / 255)
    static let primaryLight = Color(red: 250 / 255, green: 238 / 255, blue: 218 / 255)
    static let ink = Color(uiColor: .label)
    static let inkMid = Color(uiColor: .secondaryLabel)
    static let inkLight = Color(uiColor: .tertiaryLabel)
    static let background = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
}

struct BeckettCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(BeckettColor.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
