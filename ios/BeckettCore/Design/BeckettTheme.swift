import SwiftUI
import UIKit

enum BeckettColor {
    static let primary = Color(red: 186 / 255, green: 117 / 255, blue: 23 / 255)
    static let primaryDark = Color(red: 133 / 255, green: 79 / 255, blue: 11 / 255)
    static let primaryLight = Color(red: 250 / 255, green: 238 / 255, blue: 218 / 255)
    static let ink = Color(red: 26 / 255, green: 25 / 255, blue: 23 / 255)
    static let inkMid = Color(red: 74 / 255, green: 72 / 255, blue: 69 / 255)
    static let inkLight = Color(red: 138 / 255, green: 135 / 255, blue: 132 / 255)
    static let background = Color(red: 251 / 255, green: 248 / 255, blue: 243 / 255)
    static let backgroundRaised = Color(red: 243 / 255, green: 237 / 255, blue: 227 / 255)
    static let card = Color.white
    static let border = ink.opacity(0.1)
}

struct BeckettBrandHeader: View {
    var body: some View {
        Image("BeckettWordmark")
            .resizable()
            .scaledToFit()
            .frame(width: 120, height: 30)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Beckett")
    }
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
                    .stroke(BeckettColor.border, lineWidth: 0.5)
            }
    }
}

struct BeckettPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(
                isEnabled
                    ? (configuration.isPressed ? BeckettColor.primaryDark : BeckettColor.primary)
                    : BeckettColor.primary.opacity(0.45),
                in: Capsule()
            )
    }
}

extension View {
    func beckettBrandNavigation() -> some View {
        self
            .navigationTitle("Beckett")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    BeckettBrandHeader()
                }
            }
    }

    func beckettPage() -> some View {
        self
            .foregroundStyle(BeckettColor.ink)
            .background(BeckettColor.background.ignoresSafeArea())
    }
}
