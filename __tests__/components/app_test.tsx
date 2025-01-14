import * as React from "react";
import { App, RawApp } from "../../src/components/app";
import { shallow, mount, ReactWrapper } from "enzyme";
import { waitImmediate } from "../helper";
import { MemoryRouter } from "react-router";
import * as ReactRouterDom from "react-router-dom";
import { GithubCallback } from "../../src/components/github_callback";
import { AppBar, Typography, IconButton, Drawer } from "@material-ui/core";
import { MenuButton } from "../../src/components/menu_button";
import { GithubButton } from "../../src/components/github_button";

describe("App", function() {
  let fetch: jest.Mock;

  beforeEach(function() {
    window.localStorage.clear();

    fetch = jest.fn();
    const data = {
      data: {
        viewer: {
          login: "user",
          avatarUrl: "url-to-avatar",
          __typename: "User"
        }
      }
    };
    const organizations = {
      data: {
        viewer: {
          organizations: {
            nodes: [
              {
                login: "org",
                avatarUrl: "url-to-avatar",
                __typename: "Organization"
              }
            ],
            __typename: "OrganizationConnection"
          },
          __typename: "User"
        }
      }
    };
    const repositories = {
      data: {
        viewer: {
          repositories: {
            nodes: [{ name: "reponame", __typename: "Repository" }],
            __typename: "RepositoryConnection"
          },
          __typename: "User"
        }
      }
    };

    const orgRepositories = {
      data: {
        organization: {
          repositories: {
            edges: [
              {
                node: {
                  name: "repo",
                  __typename: "Repository"
                },
                __typename: "RepositoryEdge"
              }
            ],
            __typename: "RepositoryConnection"
          },
          __typename: "Organization"
        }
      }
    };

    function getData(body: string) {
      if (body.includes("organizations")) return organizations;

      if (body.includes("getRepos")) return repositories;

      if (body.includes("getOrgRepositories")) return orgRepositories;

      return data;
    }

    fetch.mockImplementation((_input, init: any) => {
      const responseData = getData(init.body);

      return Promise.resolve({
        statusCode: 404,
        json() {
          return responseData;
        },
        text() {
          return Promise.resolve(JSON.stringify(responseData));
        }
      });
    });
  });

  describe("AppBar", function() {
    it("renders the tilte and GithubButton", function() {
      const wrapper = mount(<App fetch={fetch} />);

      const appBar = wrapper.find(AppBar);
      expect(appBar).toHaveLength(1);

      const title = appBar.find(Typography);
      expect(title).toHaveLength(1);
      expect(title.prop("children")).toEqual("Github Stats & Releases");

      expect(appBar.find(GithubButton)).toHaveLength(1);
    });
  });

  describe("Content", function() {
    it("is an empty div if no route is selected", function() {
      const wrapper = mount(<App fetch={fetch} />);

      expect(wrapper.find("#content")).toHaveLength(1);
    });
  });

  describe("error boundary", function() {
    it("is implemented", function() {
      const wrapper = mount(<App fetch={fetch} />);
      const instance = wrapper
        .find(RawApp)
        .at(0)
        .instance() as any;

      expect(instance.componentDidCatch).toBeDefined();

      const spy = jest.spyOn(global.console, "error");
      instance.componentDidCatch("some error text", "some info");

      expect(spy).toHaveBeenCalledWith("some error text", "some info");

      spy.mockClear();
    });
  });

  describe("GithubButton", function() {
    it("onChangeToken sets the token and creates Github instance", function() {
      const wrapper = shallow(<App fetch={fetch} />);
      const rawApp = wrapper.find(RawApp);
      expect(rawApp).toHaveLength(1);
      const rawAppWrapper = rawApp.dive();

      const githubButton = rawAppWrapper.find(GithubButton);
      expect(githubButton).toHaveLength(1);
      expect(rawAppWrapper.state("github")).toBeUndefined();

      const token = "token";
      (githubButton.prop("onChangeToken") as any)(token);

      expect(rawAppWrapper.state()).toHaveProperty("github");
    });

    describe("token in localStorage", function() {
      afterEach(() => window.localStorage.clear());

      it("creates a Github instance in constructor", function() {
        window.localStorage.setItem("githubToken", "token");

        const wrapper = shallow(<App fetch={fetch} />);

        const rawApp = wrapper.find(RawApp);
        expect(rawApp).toHaveLength(1);

        const rawAppWrapper = rawApp.dive();
        expect(rawAppWrapper.state()).toHaveProperty("github");
      });
    });
  });

  [
    { component: "Stats", route: "/stats", title: "Repositories Statistics" },
    {
      component: "PersonalStats",
      route: "/personal-stats",
      title: "Personal Statistics"
    },
    {
      component: "OrgStats",
      route: "/org-stats",
      title: "Organization Statistics"
    },
    {
      component: "ReleaseNotesRetriever",
      route: "/retrieve-release-notes",
      title: "Retrieve Release Notes"
    },
    {
      component: "ReleaseNotesCreator",
      route: "/create-release-notes",
      title: "Create Release Notes"
    }
  ].forEach(entry => {
    describe(entry.component, function() {
      describe("with open drawer", function() {
        let wrapper: ReactWrapper;
        let drawer: ReactWrapper;

        beforeEach(async function() {
          wrapper = mount(<App fetch={fetch} />);
          const appBar = wrapper.find(AppBar);
          expect(appBar).toHaveLength(1);

          const menuButton = appBar.find(IconButton);
          expect(menuButton).toHaveLength(1);

          menuButton.simulate("click");
          await waitImmediate();
          wrapper = wrapper.update();

          drawer = wrapper.find(Drawer);
          expect(drawer).toHaveLength(1);
        });

        it(`shows a MenuButton to route ${entry.route}`, async function() {
          expect(drawer.prop("open")).toEqual(true);

          const button = drawer
            .find(MenuButton)
            .filterWhere(b => b.prop("to") === entry.route);
          expect(button).toHaveLength(1);
        });

        it("closes the drawer after menu item click", async function() {
          const button = drawer
            .find(MenuButton)
            .filterWhere(b => b.prop("to") === entry.route);
          expect(button).toHaveLength(1);

          button.prop("onClick")(undefined);
          await waitImmediate();
          wrapper = wrapper.update();

          drawer = wrapper.find(Drawer);
          expect(drawer.prop("open")).toEqual(false);
        });
      });

      describe("with faked BrowserRouter", function() {
        const originalBrowserRouter = ReactRouterDom.BrowserRouter;
        beforeAll(function() {
          // Redefine BrowserRouter to only render its children
          // otherwise MemoryRouter won't work
          (ReactRouterDom.BrowserRouter as any) = (params: {
            children: JSX.Element;
          }) => <div>{params.children}</div>;
        });

        afterAll(function() {
          (ReactRouterDom.BrowserRouter as any) = originalBrowserRouter;
        });

        afterEach(function() {
          window.localStorage.clear();
        });

        it(`shows ${entry.component} if route is active`, async function() {
          // ensure that we are logged in
          window.localStorage.setItem("githubToken", "token");
          history.pushState({}, entry.route, entry.route);

          const wrapper = mount(
            <MemoryRouter initialEntries={[entry.route]}>
              <App fetch={fetch} />
            </MemoryRouter>
          );

          expect(wrapper.find(<h1>Loading!</h1>));

          await waitImmediate();
          wrapper.update();

          expect(wrapper.find(entry.component)).toHaveLength(1);
          expect(wrapper.find("h5")).toHaveLength(1);
          expect(wrapper.find("h5").prop("children")).toEqual(entry.title);
        });

        it(`shows nothing if route is active but not logged in`, async function() {
          const wrapper = mount(
            <MemoryRouter initialEntries={[entry.route]}>
              <App fetch={fetch} />
            </MemoryRouter>
          );

          await waitImmediate();
          wrapper.update();

          expect(wrapper.find(entry.component)).toHaveLength(0);
        });
      });
    });
  });

  describe("GithubCallback", function() {
    const originalBrowserRouter = ReactRouterDom.BrowserRouter;
    beforeAll(function() {
      // Redefine BrowserRouter to only render its children
      // otherwise MemoryRouter won't work
      (ReactRouterDom.BrowserRouter as any) = (params: {
        children: JSX.Element;
      }) => <div>{params.children}</div>;
    });

    afterAll(function() {
      (ReactRouterDom.BrowserRouter as any) = originalBrowserRouter;
    });

    beforeEach(function() {
      const result = {
        data: {
          viewer: {
            login: "user",
            avatarUrl: "url-to-avatar",
            __typename: "User"
          }
        }
      };
      fetch.mockReset();
      fetch.mockReturnValue(
        Promise.resolve({
          statusCode: 200,
          json() {
            return result;
          },
          text() {
            return Promise.resolve(JSON.stringify(result));
          }
        })
      );
    });

    it("renders GithubCallback for /auth-callback route", function() {
      const wrapper = mount(
        <MemoryRouter initialEntries={["/auth-callback"]}>
          <App fetch={fetch} />
        </MemoryRouter>
      );

      const githubCallback = wrapper.find(GithubCallback);
      expect(githubCallback).toHaveLength(1);
    });

    describe("onChangeToken", function() {
      afterEach(function() {
        window.localStorage.clear();
      });

      it("calls App.onChangeToken and sets local storage", function() {
        window.localStorage.setItem("githubToken", "my-token");
        const wrapper = mount(
          <MemoryRouter initialEntries={["/auth-callback"]}>
            <App fetch={fetch} />
          </MemoryRouter>
        );

        const newToken: string = undefined;
        const githubCallback = wrapper.find(GithubCallback);
        githubCallback.prop("onChangeToken")(newToken);

        expect(window.localStorage.getItem("githubToken")).toBeFalsy();
      });
    });
  });
});
