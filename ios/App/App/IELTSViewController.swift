import UIKit
import WebKit
import Capacitor

/// Keeps the library page alive and opens practice as a real child WKWebView.
/// window.open then has a genuine opener, closed state, and postMessage source.
final class PracticeWindowHost: NSObject, WKUIDelegate {
    static let shared = PracticeWindowHost()
    weak var container: UIView?
    private var children: [WKWebView] = []
    private var originalDelegate: WKUIDelegate?
    #if DEBUG
    private weak var diagnosticRoot: WKWebView?
    private var diagnosticTimer: Timer?
    private var diagnosticSnapshots: [String: String] = [:]
    private let diagnosticLabel = UILabel(frame: CGRect(x: 1, y: 1, width: 1, height: 1))
    private let diagnosticScript = #"""
    (() => {
      if (!window.__mobileUITestEvents) {
        window.__mobileUITestEvents = [];
        window.__mobileUITestErrors = [];
        window.addEventListener('message', event => {
          let registration = null;
          window.app?.examWindows?.forEach(info => { if (info.window === event.source) registration = info; });
          const data = event.data?.data || {};
          window.__mobileUITestEvents.push({type:event.data?.type,tag:event.data?.source,origin:event.origin,
            fromOpener:event.source === window.opener,fromRegisteredChild:!!registration,
            tokenPresent:!!data.windowSessionToken,tokenMatches:registration ? data.windowSessionToken === registration.windowSessionToken : null,
            declaredOrigin:data.parentOrigin});
          window.__mobileUITestEvents = window.__mobileUITestEvents.slice(-12);
        });
        window.addEventListener('error', event => window.__mobileUITestErrors.push(String(event.message).slice(0,180)));
        window.addEventListener('unhandledrejection', event => window.__mobileUITestErrors.push(String(event.reason?.message || event.reason).slice(0,180)));
      }
      const registrations = [];
      window.app?.examWindows?.forEach(info => registrations.push({origin:info.expectedOrigin,opaque:info.allowOpaqueOrigin,
        nativeBound:window.app._isLocalNativeAppUrl?.(info.expectedUrl),hasWindow:!!info.window,closed:info.window?.closed,
        ready:info.ready,tokenPresent:!!info.windowSessionToken}));
      let openerClosed = null;
      try { openerClosed = window.opener ? window.opener.closed : null; } catch (_) {}
      return JSON.stringify({protocol:location.protocol,host:location.host,origin:location.origin,urlOrigin:new URL(location.href).origin,
        referrerOrigin:document.referrer ? new URL(document.referrer).origin : '',hasOpener:!!window.opener,openerClosed,
        ready:!!window.__IELTS_READING_READY__,rightInert:document.getElementById('right')?.inert,inputCount:document.querySelectorAll('#right input').length,
        registrations,messages:window.__mobileUITestEvents,errors:window.__mobileUITestErrors.slice(-4)});
    })();
    """#

    private func prepareDiagnostics(root: WKWebView, host: UIView) {
        guard ProcessInfo.processInfo.arguments.contains("--mobile-ui-diagnostics") else { return }
        diagnosticRoot = root
        diagnosticLabel.text = "Native diagnostics"
        diagnosticLabel.textColor = .clear
        diagnosticLabel.isAccessibilityElement = true
        diagnosticLabel.accessibilityIdentifier = "mobile-native-diagnostics"
        host.addSubview(diagnosticLabel)
        root.configuration.userContentController.addUserScript(WKUserScript(source: diagnosticScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        diagnosticTimer?.invalidate()
        diagnosticTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in self?.collectDiagnostics() }
        collectDiagnostics()
    }

    private func collectDiagnostics() {
        let views = [diagnosticRoot].compactMap { $0 } + children
        for view in views {
            let key = view === diagnosticRoot ? "library" : "practice"
            view.evaluateJavaScript(diagnosticScript) { [weak self] value, _ in
                guard let self, let snapshot = value as? String else { return }
                self.diagnosticSnapshots[key] = snapshot
                self.diagnosticLabel.accessibilityValue = self.diagnosticSnapshots.sorted { $0.key < $1.key }.map { $0.key + ": " + $0.value }.joined(separator: "\n")
                self.container?.bringSubviewToFront(self.diagnosticLabel)
            }
        }
    }
    #endif

    func attach(to controller: UIViewController, webView: WKWebView) {
        container = controller.view
        originalDelegate = webView.uiDelegate
        webView.uiDelegate = self
        webView.isOpaque = true
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif
        let preferences = webView.configuration.preferences
        preferences.javaScriptCanOpenWindowsAutomatically = true
        #if DEBUG
        prepareDiagnostics(root: webView, host: controller.view)
        #endif
    }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || originalDelegate?.responds(to: selector) == true
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        if let delegate = originalDelegate, delegate.responds(to: selector) { return delegate }
        return super.forwardingTarget(for: selector)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let host = container else { return nil }
        let child = WKWebView(frame: host.bounds, configuration: configuration)
        child.translatesAutoresizingMaskIntoConstraints = false
        child.uiDelegate = self
        child.isOpaque = true
        child.backgroundColor = .systemBackground
        child.scrollView.backgroundColor = .systemBackground
        child.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) {
            child.isInspectable = true
        }
        #endif
        host.addSubview(child)
        NSLayoutConstraint.activate([
            child.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            child.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            child.topAnchor.constraint(equalTo: host.topAnchor),
            child.bottomAnchor.constraint(equalTo: host.bottomAnchor)
        ])
        host.layoutIfNeeded()
        children.append(child)
        return child
    }

    func webViewDidClose(_ webView: WKWebView) {
        webView.removeFromSuperview()
        children.removeAll { $0 === webView }
    }
}

class IELTSViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView else { return }
        PracticeWindowHost.shared.attach(to: self, webView: webView)
    }
}
