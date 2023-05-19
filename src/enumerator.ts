interface HTMLAttribute {
  name: string;
  value: string;
}

function parseHTMLAttributes(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): HTMLAttribute[] {
  const parsedAttributes: HTMLAttribute[] = [
    { name: "tagname", value: element.tagName },
  ];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    parsedAttributes.push({ name: attr.name.toLowerCase(), value: attr.value });
  }
  return parsedAttributes;
}

function getToEInputs(): HTMLAttribute[][] {
  const inputs: NodeListOf<HTMLInputElement> =
      document.querySelectorAll("input"),
    textareas: NodeListOf<HTMLTextAreaElement> =
      document.querySelectorAll("textarea"),
    selects: NodeListOf<HTMLSelectElement> =
      document.querySelectorAll("select"),
    toeInputs: HTMLAttribute[][] = [];

  for (const htmlElements of [inputs, textareas, selects]) {
    htmlElements.forEach((htmlElement) => {
      const parsedElement = parseHTMLAttributes(htmlElement);

      toeInputs.push(parsedElement);
    });
  }

  return toeInputs;
}

document.addEventListener("DOMContentLoaded", () => {
  void fetch(
    "https://s8du5jy3c2.execute-api.eu-central-1.amazonaws.com/stage/",
    {
      method: "post",
      body: JSON.stringify({
        host: window.location.hostname,
        inputs: getToEInputs(),
        path: window.location.pathname,
      }),
      headers: { "Content-Type": "application/json" },
    }
  );
});
