fn main() {
    // Link against ApplicationServices framework on macOS for accessibility APIs
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=ApplicationServices");
    }
}
