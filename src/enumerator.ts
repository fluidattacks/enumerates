interface HTMLAttribute {
  name: string;
  value: string;
}

function parseHTMLAttributes(
  element: HTMLInputElement | HTMLTextAreaElement
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
    toeInputs: HTMLAttribute[][] = [];

  inputs.forEach((input: HTMLInputElement) => {
    const parsedInput = parseHTMLAttributes(input);
    toeInputs.push(parsedInput);
  });

  textareas.forEach((textarea: HTMLTextAreaElement) => {
    const parsedTextarea = parseHTMLAttributes(textarea);
    toeInputs.push(parsedTextarea);
  });
  return toeInputs;
}

void fetch("https://s8du5jy3c2.execute-api.eu-central-1.amazonaws.com/stage/", {
  method: "post",
  body: JSON.stringify({
    host: window.location.hostname,
    inputs: getToEInputs(),
    path: window.location.pathname,
  }),
  headers: { "Content-Type": "application/json" },
});
