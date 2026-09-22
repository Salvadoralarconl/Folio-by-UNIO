#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::Serialize;
use std::{fs, io::Write, path::{Component, Path, PathBuf}, time::UNIX_EPOCH};

#[derive(Serialize)]
struct Entry { path: String, name: String, kind: &'static str, size: u64, modified: u128 }

fn root() -> Result<PathBuf, String> {
    let path = dirs::home_dir().ok_or("Your home folder could not be found")?.join("Folio");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.canonicalize().map_err(|e| e.to_string())
}

// Every command is confined to ~/Folio. Reject traversal and links, including
// existing parent junctions, before reading, writing, moving, or opening anything.
fn resolve(relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty() { return Err("Choose a file or folder".into()); }
    let base = root()?;
    let mut result = base.clone();
    for component in Path::new(relative).components() {
        match component {
            Component::Normal(name) => {
                let text = name.to_string_lossy();
                if text.starts_with('.') || text.contains(':') || text.ends_with('.') || text.ends_with(' ') {
                    return Err("Hidden or invalid paths are not supported".into());
                }
                result.push(name);
                if result.exists() {
                    let info = fs::symlink_metadata(&result).map_err(|e| e.to_string())?;
                    if info.file_type().is_symlink() { return Err("Symbolic links are not supported".into()); }
                    if !result.canonicalize().map_err(|e| e.to_string())?.starts_with(&base) { return Err("Path is outside your document repository".into()); }
                }
            }
            _ => return Err("Invalid repository path".into()),
        }
    }
    Ok(result)
}

#[tauri::command]
fn list_entries() -> Result<Vec<Entry>, String> {
    fn walk(base: &Path, folder: &Path, result: &mut Vec<Entry>) -> Result<(), String> {
        for item in fs::read_dir(folder).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let name = item.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') { continue; }
            let info = fs::symlink_metadata(item.path()).map_err(|e| e.to_string())?;
            if info.file_type().is_symlink() || (!info.is_file() && !info.is_dir()) { continue; }
            let canonical = item.path().canonicalize().map_err(|e| e.to_string())?;
            if !canonical.starts_with(base) { continue; }
            result.push(Entry { path: item.path().strip_prefix(base).map_err(|e|e.to_string())?.to_string_lossy().replace('\\', "/"), name, kind: if info.is_dir() { "folder" } else { "file" }, size: if info.is_file() { info.len() } else { 0 }, modified: info.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|t|t.as_millis()).unwrap_or(0) });
            if info.is_dir() { walk(base, &item.path(), result)?; }
        }
        Ok(())
    }
    let base = root()?; let mut result = Vec::new(); walk(&base, &base, &mut result)?; Ok(result)
}
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    let file = resolve(&path)?;
    if fs::metadata(&file).map_err(|e|e.to_string())?.len() > 100 * 1024 * 1024 { return Err("File is too large for inline preview. Open it in the default app.".into()); }
    fs::read(file).map_err(|e| e.to_string())
}
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> { fs::create_dir(resolve(&path)?).map_err(|e|e.to_string()) }
#[tauri::command]
fn write_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = resolve(&path)?;
    fs::create_dir_all(target.parent().ok_or("Invalid parent folder")?).map_err(|e|e.to_string())?;
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(|e|e.to_string())?;
    if let Err(e) = file.write_all(&bytes).and_then(|_|file.sync_all()) { drop(file); let _ = fs::remove_file(&target); return Err(e.to_string()); }
    Ok(())
}
#[tauri::command]
fn replace_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = resolve(&path)?;
    if !target.is_file() { return Err("Original file is missing".into()); }
    let folder = root()?.join(".folio-edit-backups");
    fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
    let stamp = std::time::SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let backup = folder.join(format!("{}-{}",stamp,target.file_name().ok_or("Invalid name")?.to_string_lossy()));
    fs::copy(&target,&backup).map_err(|e|e.to_string())?;
    let mut file = fs::OpenOptions::new().write(true).truncate(true).open(&target).map_err(|e|e.to_string())?;
    if let Err(error) = file.write_all(&bytes).and_then(|_|file.sync_all()) {
        drop(file); let _ = fs::copy(&backup,&target); return Err(error.to_string());
    }
    Ok(())
}
#[tauri::command]
fn move_entry(from: String, to: String) -> Result<(), String> {
    let source = resolve(&from)?; let destination = resolve(&to)?;
    if destination.exists() { return Err("An item already exists at this location".into()); }
    if destination.starts_with(&source) { return Err("Cannot move a folder inside itself".into()); }
    fs::rename(source, destination).map_err(|e|e.to_string())
}
#[tauri::command]
fn delete_entry(path: String) -> Result<(), String> {
    let target = resolve(&path)?;
    if target.is_dir() { fs::remove_dir_all(target) } else { fs::remove_file(target) }.map_err(|e|e.to_string())
}
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    let target = resolve(&path)?;
    let ext = target.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase();
    if !["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv","rtf","odt","ods","odp","png","jpg","jpeg","webp","gif","bmp","tiff","md"].contains(&ext.as_str()) {
        return Err("Open this file from your file manager. This file type is not enabled for automatic launching.".into());
    }
    if !target.is_file() { return Err("The file is no longer available".into()); }
    open::that(target).map_err(|e|e.to_string())
}
#[tauri::command]
fn reveal_file(path: String) -> Result<(), String> {
    let target = resolve(&path)?;
    #[cfg(target_os = "windows")]
    { std::process::Command::new("explorer.exe").arg(format!("/select,{}",target.display())).spawn().map_err(|e|e.to_string())?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg("-R").arg(target).spawn().map_err(|e|e.to_string())?; }
    #[cfg(target_os = "linux")]
    { open::that(target.parent().ok_or("Invalid folder")?).map_err(|e|e.to_string())?; }
    Ok(())
}
fn main() {
    tauri::Builder::default().invoke_handler(tauri::generate_handler![list_entries,read_file,create_folder,write_file,replace_file,move_entry,delete_entry,open_file,reveal_file]).run(tauri::generate_context!()).expect("Unable to start Folio");
}
