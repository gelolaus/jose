import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePlaceDrag } from "./use-place-drag";

function Probe({ allowDrag = true }: { allowDrag?: boolean }) {
  const drag = usePlaceDrag({
    disabled: false,
    dropSelector: "[data-drop]",
    allowDrag,
    onDrop: () => {},
  });
  return (
    <button
      type="button"
      onPointerDown={(event) => drag.onPointerDown(event, "a", "A")}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onClick={() => {
        if (drag.consumeClick()) return;
        drag.select(drag.selected === "a" ? null : "a");
      }}
    >
      {drag.selected === "a" ? "on" : "off"}
    </button>
  );
}

describe("usePlaceDrag tap", () => {
  afterEach(() => cleanup());

  it("does not select on pointerdown; a click selects", () => {
    render(<Probe />);
    const chip = screen.getByRole("button");
    fireEvent.pointerDown(chip, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: "mouse",
    });
    expect(chip.textContent).toBe("off");
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.click(chip);
    expect(chip.textContent).toBe("on");
  });

  it("selects from a click when drag is disabled", () => {
    render(<Probe allowDrag={false} />);
    const chip = screen.getByRole("button");
    fireEvent.click(chip);
    expect(chip.textContent).toBe("on");
  });
});
