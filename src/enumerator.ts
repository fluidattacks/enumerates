interface HTMLAttribute {
  name: string;
  value: string;
}

interface ToEInputs {
  cookies: string[];
  forms: HTMLAttribute[][];
}

// Global variable used in SPAs to keep track of enumerated inputs
// and avoid doing unnecessary calls to the enumerator API
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

function getXPath(element: Element): string {
  if (element.id !== "") {
    return `//*[@id='${element.id}']`;
  }
  if (element.tagName.toLowerCase() === "html") {
    return "/html";
  }

  const parent = element.parentElement;
  if (parent !== null) {
    const siblings = parent.children;
    let idx = 1;

    if (siblings.length > 1) {
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];

        if (element === sibling) {
          return getXPath(parent) + `/${element.tagName.toLowerCase()}[${idx}]`;
        }
        if (element.tagName === sibling.tagName) {
          idx++;
        }
      }
    } else {
      return getXPath(parent) + `/${element.tagName.toLowerCase()}`;
    }
  }

  throw new Error();
}

function parseHTMLAttributes(element: Element): HTMLAttribute[] {
  const parsedAttributes: HTMLAttribute[] = [
    { name: "tagname", value: element.tagName.toLowerCase() },
    { name: "xpath", value: getXPath(element) },
  ];

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    parsedAttributes.push({
      name: attr.name.toLowerCase(),
      value: attr.value,
    });
  }
  return parsedAttributes.sort(
    (a, b) => a.name.charCodeAt(0) - b.name.charCodeAt(0)
  );
}

function getFormInputs(): HTMLAttribute[][] {
  const toeInputs: HTMLAttribute[][] = [];

  for (const elementType of ["input", "select", "textarea"]) {
    const elements = document.querySelectorAll(`form ${elementType}`);

    for (const element of elements) {
      try {
        const parsedElement = parseHTMLAttributes(element);
        toeInputs.push(parsedElement);
      } catch (e) {
        console.log(e);
      }
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

function getDiffInputs(inputs: ToEInputs): ToEInputs {
  const diffCookies: string[] = [];
  const diffFormInputs: HTMLAttribute[][] = [];

  let hash: number;
  for (const formInput of inputs.forms) {
    let xpath = "";
    for (const attr of formInput.slice().reverse()) {
      if (attr.name === "xpath") {
        xpath = attr.value;
        break;
      }
    }

    if (xpath !== "") {
      hash = stringToHash(
        document.location.hostname +
          document.location.pathname +
          document.location.hash +
          xpath
      );

      if (fAToEInputs.indexOf(hash) === -1) {
        fAToEInputs.push(hash);
        diffFormInputs.push(formInput);
      }
    }
  }

  for (const cookie of inputs.cookies) {
    hash = stringToHash(document.location.hostname + cookie);

    if (fAToEInputs.indexOf(hash) === -1) {
      fAToEInputs.push(hash);
      diffCookies.push(cookie);
    }
  }

  return { cookies: diffCookies, forms: diffFormInputs };
}

export function enumerateInputs(): void {
  const formInputs = getFormInputs();
  const cookieInputs = getCookieInputs();
  const newInputs = getDiffInputs({ cookies: cookieInputs, forms: formInputs });

  if (newInputs.cookies.length > 0 || newInputs.forms.length > 0) {
    void fetch("${PULUMI_REST_API_URL}", {
      method: "post",
      body: JSON.stringify({
        location: {
          hash: document.location.hash,
          host: document.location.hostname,
          path: document.location.pathname,
        },
        inputs: newInputs,
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
