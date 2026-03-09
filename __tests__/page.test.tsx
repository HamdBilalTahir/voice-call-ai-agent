import { render } from "@testing-library/react";
import Home from "../src/app/page";
import "@testing-library/jest-dom";

describe("Home", () => {
  it("renders without crashing", () => {
    render(<Home />);
  });
});
