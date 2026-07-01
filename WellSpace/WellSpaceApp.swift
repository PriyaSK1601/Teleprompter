import SwiftUI

@main
struct WellSpaceApp: App {
    @StateObject private var model = WellSpaceModel()
    @State private var immersionStyle: ImmersionStyle = .mixed

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
        .defaultSize(width: 1180, height: 820)

        WindowGroup(id: "RoomVolume") {
            RoomVolumeView()
                .environmentObject(model)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 1.4, height: 0.85, depth: 1.1, in: .meters)

        ImmersiveSpace(id: "WellnessSpace") {
            ImmersiveWellnessView()
                .environmentObject(model)
        }
        .immersionStyle(selection: $immersionStyle, in: .mixed)
    }
}
