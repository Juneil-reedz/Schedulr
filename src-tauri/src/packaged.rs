//! When Schedulr runs from its Microsoft Store (MSIX) package, a few things work the Store way:
//! the Store delivers updates (so the app never checks GitHub), starting with Windows goes
//! through the package's startup task, and notifications are sent as the packaged app.
//! The same program, installed with the normal installer, keeps its usual behaviour.

/// The startup task declared in the package manifest (scripts/msix/AppxManifest.xml).
#[allow(dead_code)]
pub const STARTUP_TASK: &str = "SchedulrStartup";

#[cfg(windows)]
mod imp {
    use super::STARTUP_TASK;
    use std::sync::OnceLock;
    use windows::core::HSTRING;
    use windows::ApplicationModel::Activation::ActivationKind;
    use windows::ApplicationModel::{AppInstance, Package, StartupTask, StartupTaskState};
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};

    fn e(err: windows::core::Error) -> String {
        err.message()
    }

    pub fn is_packaged() -> bool {
        static PACKAGED: OnceLock<bool> = OnceLock::new();
        *PACKAGED.get_or_init(|| Package::Current().is_ok())
    }

    /// Windows started the app at sign-in through the startup task.
    pub fn started_at_sign_in() -> bool {
        is_packaged()
            && AppInstance::GetActivatedEventArgs()
                .and_then(|a| a.Kind())
                .map(|k| k == ActivationKind::StartupTask)
                .unwrap_or(false)
    }

    fn task() -> Result<StartupTask, String> {
        StartupTask::GetAsync(&HSTRING::from(STARTUP_TASK)).map_err(e)?.join().map_err(e)
    }

    pub fn autostart_enabled() -> Result<bool, String> {
        let s = task()?.State().map_err(e)?;
        Ok(s == StartupTaskState::Enabled || s == StartupTaskState::EnabledByPolicy)
    }

    /// Turns starting at sign-in on or off. Returns the resulting state; Windows keeps it off
    /// when the person turned it off in Task Manager or Settings, which only they can undo.
    pub fn set_autostart(on: bool) -> Result<bool, String> {
        let t = task()?;
        if on {
            let s = t.RequestEnableAsync().map_err(e)?.join().map_err(e)?;
            match s {
                StartupTaskState::Enabled | StartupTaskState::EnabledByPolicy => Ok(true),
                StartupTaskState::DisabledByUser => Err(
                    "Windows has Schedulr's start-up turned off. Turn it on in Settings > Apps > Startup.".into(),
                ),
                StartupTaskState::DisabledByPolicy => Err("Your organisation doesn't allow apps to start at sign-in.".into()),
                _ => Ok(false),
            }
        } else {
            t.Disable().map_err(e)?;
            Ok(false)
        }
    }

    fn xml(s: &str) -> String {
        s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
    }

    /// The same toast the notification plugin builds, sent as the packaged app.
    pub fn notify(title: &str, body: &str, sound: Option<&str>) -> Result<(), String> {
        let audio = match sound {
            None => r#"<audio silent="true"/>"#.to_string(),
            Some("Default") => String::new(),
            Some(s @ ("Alarm" | "Call")) => format!(r#"<audio src="ms-winsoundevent:Notification.Looping.{s}"/>"#),
            Some(s) => format!(r#"<audio src="ms-winsoundevent:Notification.{}"/>"#, xml(s)),
        };
        let doc = XmlDocument::new().map_err(e)?;
        doc.LoadXml(&HSTRING::from(format!(
            r#"<toast><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual>{audio}</toast>"#,
            xml(title),
            xml(body)
        )))
        .map_err(e)?;
        let toast = ToastNotification::CreateToastNotification(&doc).map_err(e)?;
        ToastNotificationManager::CreateToastNotifier().map_err(e)?.Show(&toast).map_err(e)
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn is_packaged() -> bool {
        false
    }
    pub fn started_at_sign_in() -> bool {
        false
    }
    pub fn autostart_enabled() -> Result<bool, String> {
        Err("Not packaged".into())
    }
    pub fn set_autostart(_on: bool) -> Result<bool, String> {
        Err("Not packaged".into())
    }
    pub fn notify(_title: &str, _body: &str, _sound: Option<&str>) -> Result<(), String> {
        Err("Not packaged".into())
    }
}

pub use imp::*;

#[cfg(test)]
mod tests {
    #[test]
    fn a_test_run_is_not_the_store_package() {
        assert!(!super::is_packaged());
        assert!(!super::started_at_sign_in());
    }
}
