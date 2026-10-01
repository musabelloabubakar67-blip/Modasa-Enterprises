fn main() {
    // Declare the app's commands so capabilities can grant them, including to the remote server pages.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_config",
            "save_config",
            "list_printers",
            "print_raw",
            "test_print",
            "open_server",
            "open_settings",
            "exit_app",
            "open_external",
        ]),
    ))
    .expect("failed to run tauri-build");
}
