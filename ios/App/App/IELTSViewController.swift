import UIKit
import WebKit
import Capacitor

/// Keeps the library page alive and opens practice as a real child WKWebView.
/// window.open then has a genuine opener, closed state, and postMessage source.
final class PracticeWindowHost: NSObject, WKUIDelegate {
    static let shared = PracticeWindowHost()
    weak var container: UIView?
    private var children: [WKWebView] = []

    func attach(to controller: UIViewController, webView: WKWebView) {
        container = controller.view
        webView.uiDelegate = self
        let preferences = webView.configuration.preferences
        preferences.javaScriptCanOpenWindowsAutomatically = true
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let child = WKWebView(frame: container?.bounds ?? .zero, configuration: configuration)
        child.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        child.uiDelegate = self
        child.scrollView.contentInsetAdjustmentBehavior = .never
        container?.addSubview(child)
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
