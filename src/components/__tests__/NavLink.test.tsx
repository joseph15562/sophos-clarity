import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { MemoryRouter } from "react-router-dom";
import { NavLink } from "@/components/NavLink";

describe("NavLink", () => {
  it("renders link with children", () => {
    render(
      <MemoryRouter>
        <NavLink to="/test">Test Link</NavLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Test Link" })).toBeVisible();
  });

  it("applies active class on matching route", () => {
    render(
      <MemoryRouter initialEntries={["/test"]}>
        <NavLink to="/test" activeClassName="active">
          Test
        </NavLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Test" });
    expect(link).toHaveClass("active");
  });

  it("applies base className", () => {
    render(
      <MemoryRouter>
        <NavLink to="/here" className="base">
          Here
        </NavLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Here" })).toHaveClass("base");
  });
});
