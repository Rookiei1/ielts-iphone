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
