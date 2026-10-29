// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0"),
        .package(name: "CapacitorApp", path: "../../../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.6.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorBrowser", path: "../../../../../node_modules/.pnpm/@capacitor+browser@8.0.5_@capacitor+core@8.6.0/node_modules/@capacitor/browser"),
        .package(name: "CapacitorGeolocation", path: "../../../../../node_modules/.pnpm/@capacitor+geolocation@8.2.4_@capacitor+core@8.6.0/node_modules/@capacitor/geolocation"),
        .package(name: "CapacitorShare", path: "../../../../../node_modules/.pnpm/@capacitor+share@8.0.3_@capacitor+core@8.6.0/node_modules/@capacitor/share"),
        .package(name: "CapacitorNetwork", path: "../../../../../node_modules/.pnpm/@capacitor+network@8.0.1_@capacitor+core@8.6.0/node_modules/@capacitor/network"),
        .package(name: "CapacitorCommunityTextToSpeech", path: "../../../../../node_modules/.pnpm/@capacitor-community+text-to-speech@8.0.2_@capacitor+core@8.6.0/node_modules/@capacitor-community/text-to-speech")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorGeolocation", package: "CapacitorGeolocation"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorCommunityTextToSpeech", package: "CapacitorCommunityTextToSpeech")
            ]
        )
    ]
)
