import { render, screen } from "@testing-library/react";
import { Hero } from "./Hero";
import { MAX_DPR, cappedDpr, smooth } from "./shaderRunner";

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduced && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);   // jsdom has no WebGL
});
afterEach(() => vi.restoreAllMocks());

it("caps the device pixel ratio", () => {
  expect(cappedDpr(3)).toBe(MAX_DPR);
  expect(cappedDpr(1.25)).toBe(1.25);
  expect(cappedDpr(0)).toBe(1);
});

it("smooths the cursor the same way at any frame rate", () => {
  const at60 = Array.from({ length: 60 }).reduce<number>((v) => smooth(v, 1, 1 / 60), 0);
  const at30 = Array.from({ length: 30 }).reduce<number>((v) => smooth(v, 1, 1 / 30), 0);
  expect(at60).toBeCloseTo(at30, 6);
  expect(smooth(0, 1, 0)).toBe(0);
});

it("with reduced motion: static gradient, no canvas, headline still there", () => {
  mockReducedMotion(true);
  const { container } = render(<Hero />);
  expect(screen.getByRole("heading", { level: 1, name: "Alessandro Kevin Aprilio" })).toBeInTheDocument();
  expect(screen.getByRole("note")).toHaveTextContent("Static gradient (reduced motion)");
  expect(container.querySelector(".hero__canvas")).toBeNull();
  expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
});

it("without WebGL 2: falls back to the static gradient instead of a blank hero", () => {
  mockReducedMotion(false);
  render(<Hero />);
  expect(screen.getByRole("note")).toHaveTextContent("Static gradient (no WebGL 2)");
});

it("links stay on the site's base path", () => {
  mockReducedMotion(true);
  render(<Hero />);
  expect(screen.getByRole("link", { name: "See the button lab" })).toHaveAttribute("href", "/buttons/");
});
