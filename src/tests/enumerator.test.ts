import fetchMock from "jest-fetch-mock";
import { enumerateInputs } from "../enumerator";

fetchMock.enableMocks();

describe("Testing enumerator functions", () => {
  it("Enumerates inputs correctly", () => {
    document.body.innerHTML =
      "<div>" +
      "  <form>" +
      '    <input class="class1" name="input1" type="text" value="" />' +
      "    <div>" +
      '      <textarea name="textarea1" type="text" rows="6"></textarea>' +
      "    </div>" +
      "    <div>" +
      "      <div>" +
      '        <select name="select1">' +
      '          <option value="value1">Option 1</option>' +
      '          <option value="value2">Option 2</option>' +
      "        </select>" +
      "      </div>" +
      "    </div>" +
      "  </form>" +
      '  <input name="input2" type="checkbox">' +
      "</div>";
    document.cookie = "cookie1=value1";
    document.cookie = "cookie2=value2";
    document.cookie = "cookie3=value3";

    const expected_request_body = {
      location: {
        hash: "",
        host: "localhost",
        path: "/",
      },
      inputs: {
        cookies: ["cookie1", "cookie2", "cookie3"],
        forms: [
          [
            { name: "tagname", value: "input" },
            { name: "class", value: "class1" },
            { name: "name", value: "input1" },
            { name: "type", value: "text" },
            { name: "value", value: "" },
          ],
          [
            { name: "tagname", value: "select" },
            { name: "name", value: "select1" },
          ],
          [
            { name: "tagname", value: "textarea" },
            { name: "name", value: "textarea1" },
            { name: "type", value: "text" },
            { name: "rows", value: "6" },
          ],
        ],
      },
    };

    enumerateInputs();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify(expected_request_body),
      })
    );
  });
});
