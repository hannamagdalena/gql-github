import * as React from "react";

export class CopyToClipboard extends React.Component<{ text: string }, {}> {
  private copyToClipboard() {
    const range = document.createRange();
    const selection = document.getSelection();
    selection.empty();
    const copyText = document.getElementById("textToCopy");
    range.selectNode(copyText);
    selection.addRange(range);
    document.execCommand("Copy");
  }

  render() {
    return (
      <div>
        <span
          style={{
            userSelect: "text",
            whiteSpace: "pre",
            position: "absolute",
            clip: "rect(0, 0, 0, 0)"
          }}
          id="textToCopy"
        >
          {this.props.text}
        </span>
        <button onClick={() => this.copyToClipboard()}>Copy</button>
      </div>
    );
  }
}