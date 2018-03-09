import * as React from "react";

class DynamicImport<Component> extends React.Component<
  { load: () => Promise<Component> },
  { component: Component }
> {
  state = {
    component: null as any
  };

  componentWillMount() {
    this.props.load().then(component => this.setState(() => ({ component })));
  }

  render() {
    return (this.props.children as any)(this.state.component);
  }
}

export function createDynamicImport<P, T extends React.Component>(
  load: () => Promise<{ new (props: P): T }>
): React.StatelessComponent<P> {
  return (props: P) => (
    <DynamicImport load={load}>
      {(Component: typeof React.Component) =>
        Component === null ? <h1>Loading!</h1> : <Component {...props} />
      }
    </DynamicImport>
  );
}
