interface HTMLAttribute {
  name: string;
  value: string;
}

const fAToEInputs: number[] = [];

function stringToHash(string: string): number {
  let hash = 0;

  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return hash;
}

function parseHTMLAttributes(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
): HTMLAttribute[] {
  const parsedAttributes: HTMLAttribute[] = [
    { name: "tagname", value: element.tagName },
  ];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name.toLowerCase() !== "class") {
      parsedAttributes.push({
        name: attr.name.toLowerCase(),
        value: attr.value,
      });
    }
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

function enumerateInputs(): void {
  const inputs = getToEInputs(),
    diffInputs: HTMLAttribute[][] = [],
    newHashes: number[] = [];

  inputs.forEach((input: HTMLAttribute[]): void => {
    const hash = stringToHash(window.location.pathname + JSON.stringify(input));

    if (fAToEInputs.indexOf(hash) === -1) {
      newHashes.push(hash);
      fAToEInputs.push(hash);
      diffInputs.push(input);
    } else if (newHashes.indexOf(hash) > -1) {
      diffInputs.push(input);
    }
  });

  if (diffInputs.length > 0) {
    void fetch("${PULUMI_REST_API_URL}", {
      method: "post",
      body: JSON.stringify({
        host: window.location.hostname,
        inputs: diffInputs,
        path: window.location.pathname,
      }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

document.addEventListener("DOMContentLoaded", enumerateInputs);

const observer = new MutationObserver(() => {
  void enumerateInputs();
});
observer.observe(document.getRootNode(), { childList: true, subtree: true });
