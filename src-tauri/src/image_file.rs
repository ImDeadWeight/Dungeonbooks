//! Reading a picture from a file on this computer for an AI app's add_image:
//! only an image file (PNG, JPEG, WebP or GIF, by name and by its first
//! bytes) of reasonable size, given by its full path. The web UI's own file
//! access stays limited to the app's folder; this is the one narrow way out.

use std::fs;
use std::path::Path;

/// Largest picture read (bytes).
const MAX_BYTES: u64 = 25 * 1024 * 1024;

/// Whether the bytes start like one of the image types the app stores.
fn looks_like_image(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(&[0xFF, 0xD8, 0xFF])
        || bytes.starts_with(b"GIF87a")
        || bytes.starts_with(b"GIF89a")
        || (bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP")
}

/// The picture at `path`, as raw bytes; an error saying why not otherwise.
#[tauri::command]
pub fn read_image_file(path: String) -> Result<tauri::ipc::Response, String> {
    let path = Path::new(&path);
    if !path.is_absolute() {
        return Err("Give the image's full path (like C:\\Maps\\world.png).".into());
    }
    let ext = path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !["png", "jpg", "jpeg", "webp", "gif"].contains(&ext.as_str()) {
        return Err("Only .png, .jpg, .jpeg, .webp and .gif files can be added.".into());
    }
    let meta = fs::metadata(path).map_err(|e| format!("Can't open {}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err(format!("{} isn't a file.", path.display()));
    }
    if meta.len() > MAX_BYTES {
        return Err("That image is larger than 25 MB.".into());
    }
    let bytes = fs::read(path).map_err(|e| format!("Can't read {}: {e}", path.display()))?;
    if !looks_like_image(&bytes) {
        return Err("That file isn't a PNG, JPEG, WebP or GIF image.".into());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_images_by_their_first_bytes() {
        assert!(looks_like_image(b"\x89PNG\r\n\x1a\n...."));
        assert!(looks_like_image(&[0xFF, 0xD8, 0xFF, 0xE0]));
        assert!(looks_like_image(b"GIF89a"));
        assert!(looks_like_image(b"RIFF\0\0\0\0WEBPVP8 "));
        assert!(!looks_like_image(b"MZ\x90\0 not a picture"));
    }

    #[test]
    fn refuses_what_isnt_an_image_file() {
        assert!(read_image_file("relative.png".into()).is_err());
        let dir = std::env::temp_dir();
        let fake = dir.join("dungeon-books-test-fake.png");
        fs::write(&fake, b"not really a png").unwrap();
        assert!(read_image_file(fake.to_string_lossy().into_owned()).is_err());
        let text = dir.join("dungeon-books-test.txt");
        fs::write(&text, b"\x89PNG\r\n\x1a\n").unwrap();
        assert!(read_image_file(text.to_string_lossy().into_owned()).is_err());
        let real = dir.join("dungeon-books-test-real.png");
        fs::write(&real, b"\x89PNG\r\n\x1a\nrest").unwrap();
        assert!(read_image_file(real.to_string_lossy().into_owned()).is_ok());
        for f in [fake, text, real] {
            let _ = fs::remove_file(f);
        }
    }
}
