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

    const expected_request_body = {
      host: "localhost",
      inputs: [
        [
          { name: "tagname", value: "INPUT" },
          { name: "name", value: "input1" },
          { name: "type", value: "text" },
          { name: "value", value: "" },
        ],
        [
          { name: "tagname", value: "SELECT" },
          { name: "name", value: "select1" },
        ],
        [
          { name: "tagname", value: "TEXTAREA" },
          { name: "name", value: "textarea1" },
          { name: "type", value: "text" },
          { name: "rows", value: "6" },
        ],
      ],
      path: "/",
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
