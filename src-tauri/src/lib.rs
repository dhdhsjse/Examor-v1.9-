// The page as a PDF file at `path`, written by WebView2 itself (what its print would give): the exam's sheets, which the page shows
// only when printed (app/_lib/print.ts), as vector pages with the fonts' letters in them, each sheet of its own size (CSS @page).
// `width` and `height`: the paper, in inches (the first sheet's), for when the CSS size is not taken.
#[cfg(windows)]
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, path: String, width: f64, height: f64) -> Result<(), String> {
    use webview2_com::{Microsoft::Web::WebView2::Win32::*, PrintToPdfCompletedHandler};
    use windows_core::{Interface, HSTRING};

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    window
        .with_webview(move |webview| {
            let failed = tx.clone();
            let started = (|| -> windows_core::Result<()> {
                unsafe {
                    let core: ICoreWebView2_7 = webview.controller().CoreWebView2()?.cast()?;
                    let environment: ICoreWebView2Environment6 = webview.environment().cast()?;
                    let settings = environment.CreatePrintSettings()?;
                    settings.SetShouldPrintBackgrounds(true)?;
                    settings.SetShouldPrintHeaderAndFooter(false)?;
                    settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
                    settings.SetPageWidth(width)?;
                    settings.SetPageHeight(height)?;
                    settings.SetScaleFactor(1.0)?;
                    settings.SetMarginTop(0.0)?;
                    settings.SetMarginBottom(0.0)?;
                    settings.SetMarginLeft(0.0)?;
                    settings.SetMarginRight(0.0)?;
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
                        let _ = tx.send(match result {
                            Ok(()) if ok => Ok(()),
                            Ok(()) => Err("The PDF could not be written".into()),
                            Err(e) => Err(e.message()),
                        });
                        Ok(())
                    }));
                    core.PrintToPdf(&HSTRING::from(path.as_str()), &settings, &handler)
                }
            })();
            if let Err(e) = started {
                let _ = failed.send(Err(e.message()));
            }
        })
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(|e| e.to_string())?)
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(not(windows))]
#[tauri::command]
async fn export_pdf(_path: String, _width: f64, _height: f64) -> Result<(), String> {
    Err("Not available on this system".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_pdf])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
