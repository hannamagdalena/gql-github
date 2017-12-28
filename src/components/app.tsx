import * as React from "react";
import { BrowserRouter, Link, Route } from "react-router-dom";
import * as qs from "qs";

import { Hello } from "./hello";

export class App extends React.Component<{}, {}> {
  render() {
    const githubLoginUrl =
      "https://github.com/login/oauth/authorize?" +
      qs.stringify({
        client_id: "1e031c3e419938e53c8e",
        redirect_uri: window.location.origin + "/auth/callback",
        scope: "repo,user"
      });
    return (
      <BrowserRouter>
        <div>
          <Link to="/hello">Hello</Link>
          <Link to={githubLoginUrl}>Login with GitHub</Link>
          <Route path="/hello" component={Hello} />
        </div>
      </BrowserRouter>
    );
  }
}
