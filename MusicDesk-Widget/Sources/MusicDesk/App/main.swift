import AppKit

// Entry point. MusicDesk is an agent app (LSUIElement): no Dock icon, no
// Cmd-Tab entry, no menu bar. The delegate is kept alive by this global.
let app = NSApplication.shared
let appDelegate = AppDelegate()
app.delegate = appDelegate
app.setActivationPolicy(.accessory)
app.run()
