interface HTMLAttribute {
  name: string;
  value: string;
}

function parseHTMLAttributes(
  element: HTMLInputElement | HTMLTextAreaElement
): HTMLAttribute[] {
  const parsedAttributes: HTMLAttribute[] = [
    { name: "tagName", value: element.tagName },
  ];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    parsedAttributes.push({ name: attr.name, value: attr.value });
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

void fetch("http://127.0.0.1:5000/", {
  method: "post",
  body: JSON.stringify(getToEInputs()),
  headers: { "Content-Type": "application/json" },
});
