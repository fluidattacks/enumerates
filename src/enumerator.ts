interface HTMLAttribute {
  name: string;
  value: string;
}

// Global variable used in SPAs to keep track of enumerated inputs
// and avoid doing unnecessary calls to the enumerator API
// const fAToEInputs: number[] = [];

// function stringToHash(string: string): number {
//   let hash = 0;

//   for (let i = 0; i < string.length; i++) {
//     const char = string.charCodeAt(i);
//     hash = (hash << 5) - hash + char;
//     hash = hash & hash;
//   }

//   return hash;
// }

function parseHTMLAttributes(element: Element): HTMLAttribute[] {
  const parsedAttributes: HTMLAttribute[] = [
    { name: "tagname", value: element.tagName.toLowerCase() },
  ];

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    parsedAttributes.push({
      name: attr.name.toLowerCase(),
      value: attr.value,
    });
  }
  return parsedAttributes;
}

function getFormInputs(): HTMLAttribute[][] {
  const toeInputs: HTMLAttribute[][] = [];

  for (const elementType of ["input", "select", "textarea"]) {
    const elements = document.querySelectorAll(`form ${elementType}`);

    for (const element of elements) {
      const parsedElement = parseHTMLAttributes(element);
      toeInputs.push(parsedElement);
    }
  }

  return toeInputs;
}

function getCookieInputs(): string[] {
  const cookieInputs: string[] = [];
  const cookies = document.cookie;

  if (cookies.length > 0) {
    const cookieList = cookies.split(";");
    for (const cookie of cookieList) {
      cookieInputs.push(cookie.split("=")[0].trim());
    }
  }

  return cookieInputs;
}

export function enumerateInputs(): void {
  const formInputs = getFormInputs();
  const cookieInputs = getCookieInputs();

  void fetch("${PULUMI_REST_API_URL}", {
    method: "post",
    body: JSON.stringify({
      location: {
        hash: document.location.hash,
        host: document.location.hostname,
        path: document.location.pathname,
      },
      inputs: {
        cookies: cookieInputs,
        forms: formInputs,
      },
    }),
    headers: { "Content-Type": "application/json" },
  });
}

document.addEventListener("DOMContentLoaded", enumerateInputs);

const observer = new MutationObserver(() => {
  void enumerateInputs();
});
observer.observe(document.getRootNode(), { childList: true, subtree: true });
