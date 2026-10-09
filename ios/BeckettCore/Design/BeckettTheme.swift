import SwiftUI
import UIKit

enum BeckettColor {
    static let primary = adaptive(light: rgb(186, 117, 23), dark: rgb(216, 151, 62))
    static let primaryDark = adaptive(light: rgb(133, 79, 11), dark: rgb(239, 183, 99))
    static let primaryLight = adaptive(light: rgb(250, 238, 218), dark: rgb(57, 42, 21))
    static let ink = adaptive(light: rgb(26, 25, 23), dark: rgb(246, 242, 235))
    static let inkMid = adaptive(light: rgb(74, 72, 69), dark: rgb(207, 199, 188))
    static let inkLight = adaptive(light: rgb(138, 135, 132), dark: rgb(178, 169, 158))
    static let background = adaptive(light: rgb(251, 248, 243), dark: rgb(18, 17, 15))
    static let backgroundRaised = adaptive(light: rgb(243, 237, 227), dark: rgb(27, 25, 22))
    static let card = adaptive(light: .white, dark: rgb(34, 31, 27))
    static let border = ink.opacity(0.1)

    private static func rgb(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> UIColor {
        UIColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: 1)
    }

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

struct BeckettBrandHeader: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Group {
            if colorScheme == .dark {
                HStack(spacing: 7) {
                    Image("BeckettWordmark")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 31, height: 30, alignment: .leading)
                        .clipped()
                    Text("beckett")
                        .font(.system(size: 24, weight: .semibold, design: .serif).italic())
                        .foregroundStyle(BeckettColor.ink)
                }
            } else {
                Image("BeckettWordmark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 30)
            }
        }
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
