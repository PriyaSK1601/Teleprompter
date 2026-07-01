import SwiftUI

enum WellnessMood: String, CaseIterable, Identifiable {
    case calm = "Calm"
    case tired = "Tired"
    case stressed = "Stressed"
    case focused = "Focused"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .calm: "leaf"
        case .tired: "moon.zzz"
        case .stressed: "exclamationmark.triangle"
        case .focused: "target"
        }
    }
}

enum WellnessMode: String {
    case focus = "Focus"
    case sleep = "Sleep"

    var title: String {
        switch self {
        case .focus: "Focus Space"
        case .sleep: "Sleep Space"
        }
    }

    var instruction: String {
        switch self {
        case .focus: "Breathe in... breathe out... return to one clear task."
        case .sleep: "Breathe in... breathe out... let the room become softer."
        }
    }

    var tint: Color {
        switch self {
        case .focus: .green
        case .sleep: .indigo
        }
    }
}

struct WellnessMetric: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let detail: String
    let color: Color
    let systemImage: String
}

struct Recommendation: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let systemImage: String
}

struct RoomZone: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let color: Color
}

final class WellSpaceModel: ObservableObject {
    @Published var wellbeingScore = 76
    @Published var sleepScore = 68
    @Published var focusScore = 82
    @Published var stressLevel = "Moderate"
    @Published var airQuality = "Good"
    @Published var noiseLevel = "42 dB"
    @Published var lightingQuality = "Bright"
    @Published var selectedMood: WellnessMood = .calm
    @Published var selectedMode: WellnessMode = .focus
    @Published var hasScanned = false
    @Published var scanProgress = 0.0

    var metrics: [WellnessMetric] {
        [
            WellnessMetric(title: "Sleep", value: "\(sleepScore)", detail: "Evening readiness", color: .indigo, systemImage: "moon.stars.fill"),
            WellnessMetric(title: "Focus", value: "\(focusScore)", detail: "Desk zone quality", color: .green, systemImage: "target"),
            WellnessMetric(title: "Stress", value: stressLevel, detail: "Noise and light load", color: .orange, systemImage: "waveform.path.ecg"),
            WellnessMetric(title: "Air", value: airQuality, detail: "Ventilation estimate", color: .mint, systemImage: "wind"),
            WellnessMetric(title: "Noise", value: noiseLevel, detail: "Mock room average", color: .red, systemImage: "speaker.wave.2.fill"),
            WellnessMetric(title: "Lighting", value: lightingQuality, detail: "Window glare detected", color: .yellow, systemImage: "sun.max.fill")
        ]
    }

    var roomZones: [RoomZone] {
        [
            RoomZone(title: "Best focus zone", detail: "Low noise, balanced light", color: .green),
            RoomZone(title: "Sleep-friendly zone", detail: "Dim and calm", color: .green),
            RoomZone(title: "Bright light area", detail: "Reduce glare after sunset", color: .yellow),
            RoomZone(title: "Noise hotspot", detail: "Move calls away from this wall", color: .red)
        ]
    }

    var recommendations: [Recommendation] {
        switch selectedMood {
        case .calm:
            [
                Recommendation(title: "Preserve the calm zone", detail: "Keep the bed side dim and reduce notifications for the next hour.", systemImage: "leaf.fill"),
                Recommendation(title: "Hydrate gently", detail: "Drink water before your next deep work or wind-down session.", systemImage: "drop.fill")
            ]
        case .tired:
            [
                Recommendation(title: "Shift to sleep lighting", detail: "Dim the window side and avoid the bright desk zone tonight.", systemImage: "moon.fill"),
                Recommendation(title: "Cool the room", detail: "Aim for a cooler sleep zone and clear the bed area.", systemImage: "thermometer.low")
            ]
        case .stressed:
            [
                Recommendation(title: "Move away from noise", detail: "The scan found a red hotspot near the desk wall.", systemImage: "speaker.slash.fill"),
                Recommendation(title: "Start a breathing reset", detail: "Use the immersive space for a two-minute downshift.", systemImage: "lungs.fill")
            ]
        case .focused:
            [
                Recommendation(title: "Use the green desk zone", detail: "Your best focus area has balanced light and lower noise.", systemImage: "target"),
                Recommendation(title: "Protect a 25-minute block", detail: "Keep the room bright but reduce glare from the window.", systemImage: "timer")
            ]
        }
    }

    func runMockScan() {
        hasScanned = true
        scanProgress = 0.0

        withAnimation(.easeInOut(duration: 1.2)) {
            scanProgress = 1.0
            wellbeingScore = 84
            sleepScore = 79
            focusScore = 88
            stressLevel = "Low"
            airQuality = "Fresh"
            noiseLevel = "36 dB"
            lightingQuality = "Balanced"
        }
    }
}
