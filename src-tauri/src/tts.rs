//! Pip's voice on Windows. Windows' own speech engine renders each line to WAV audio with
//! the style's pitch and pace; the window then reshapes it (faster for a child, slower for
//! a giant, a warble for Grandma) before playing it. Every voice reports whether it is a
//! woman's or a man's voice, so each style can find the right one.
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Voice {
    pub id: String,
    pub name: String,
    pub lang: String,
    pub female: bool,
}

#[cfg(windows)]
mod imp {
    use super::Voice;
    use windows::core::HSTRING;
    use windows::Media::SpeechSynthesis::{SpeechSynthesizer, VoiceGender, VoiceInformation};
    use windows::Storage::Streams::DataReader;

    fn e(err: windows::core::Error) -> String {
        err.message()
    }

    fn info(v: &VoiceInformation) -> windows::core::Result<Voice> {
        Ok(Voice {
            id: v.Id()?.to_string(),
            name: v.DisplayName()?.to_string(),
            lang: v.Language()?.to_string(),
            female: v.Gender()? == VoiceGender::Female,
        })
    }

    pub fn voices() -> Result<Vec<Voice>, String> {
        let all = SpeechSynthesizer::AllVoices().map_err(e)?;
        let mut out = Vec::new();
        for i in 0..all.Size().map_err(e)? {
            if let Ok(v) = all.GetAt(i) {
                if let Ok(x) = info(&v) {
                    out.push(x);
                }
            }
        }
        Ok(out)
    }

    pub fn render(text: &str, voice_id: Option<&str>, pitch: f64, rate: f64) -> Result<Vec<u8>, String> {
        let synth = SpeechSynthesizer::new().map_err(e)?;
        if let Some(id) = voice_id {
            let all = SpeechSynthesizer::AllVoices().map_err(e)?;
            for i in 0..all.Size().map_err(e)? {
                let v = all.GetAt(i).map_err(e)?;
                if v.Id().map_err(e)?.to_string() == id {
                    synth.SetVoice(&v).map_err(e)?;
                    break;
                }
            }
        }
        // Pitch and pace need Windows 10 (1709) or later; older versions keep the defaults.
        if let Ok(opts) = synth.Options() {
            let _ = opts.SetAudioPitch(pitch.clamp(0.0, 2.0));
            let _ = opts.SetSpeakingRate(rate.clamp(0.5, 6.0));
        }
        let stream = synth.SynthesizeTextToStreamAsync(&HSTRING::from(text)).map_err(e)?.join().map_err(e)?;
        let size = stream.Size().map_err(e)? as u32;
        let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).map_err(e)?).map_err(e)?;
        reader.LoadAsync(size).map_err(e)?.join().map_err(e)?;
        let mut buf = vec![0u8; size as usize];
        reader.ReadBytes(&mut buf).map_err(e)?;
        Ok(buf)
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Voice;
    const NOT_HERE: &str = "Pip's Windows voices need Windows.";
    pub fn voices() -> Result<Vec<Voice>, String> {
        Err(NOT_HERE.into())
    }
    pub fn render(_text: &str, _voice_id: Option<&str>, _pitch: f64, _rate: f64) -> Result<Vec<u8>, String> {
        Err(NOT_HERE.into())
    }
}

pub use imp::{render, voices};

#[cfg(all(test, windows))]
mod tests {
    /// On a Windows machine with speech voices, a line renders to real WAV audio.
    #[test]
    fn renders_a_line_to_wav() {
        match super::voices() {
            Ok(list) if !list.is_empty() => {
                println!("voices: {list:?}");
                let wav = super::render("Hello, Ma'am! This is how I sound.", Some(&list[0].id), 1.4, 0.9).expect("render");
                assert_eq!(&wav[0..4], b"RIFF");
                assert!(wav.len() > 10_000, "only {} bytes", wav.len());
            }
            other => println!("no speech voices on this machine: {other:?}"),
        }
    }
}
