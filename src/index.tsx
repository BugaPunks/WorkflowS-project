import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const originalFetch = window.fetch;
window.fetch = function fetch(input, init) {
	const token = localStorage.getItem("token");
	if (token) {
		init = init ?? {};
		init.headers = init.headers ? new Headers(init.headers) : new Headers();
		if (!init.headers.has("Authorization")) {
			init.headers.set("Authorization", `Bearer ${token}`);
		}
	}
	return originalFetch.call(window, input, init);
};

const rootEl = document.getElementById("root");
if (rootEl) {
	const root = ReactDOM.createRoot(rootEl);
	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	);
}
