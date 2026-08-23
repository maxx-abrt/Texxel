"use client";

/**
 * Syna AI icon - the AI assistant brand mark.
 *
 * Renders the Syna figure as an inline SVG using `currentColor` so it
 * inherits text color and works on any background (light or dark).
 *
 * Based on the user-provided Syna.svg master (figure-only, no puzzle border)
 * for clarity at small icon sizes.
 */
export function SynaIcon({
  size = 20,
  className = "",
  title = "Syna",
  variant,
}: {
  size?: number;
  className?: string;
  title?: string;
  /** Accepted for drop-in compatibility with iconsax icons; ignored. */
  variant?: string;
}) {
  void variant;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1080 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <g transform="matrix(1.556017,0,0,1.464639,-323.214078,-273.915506)">
        <path
          d="M457,426L423,359C384.161,346.309 366.799,358.919 377,404L456,468L450,496L380,525C363.637,554.356 377.554,567.555 406,573L485,509C515.695,501.561 526.344,513.889 522,541C489.407,584.104 445.218,611.466 396,632C377.879,673.123 391.741,684.915 426,678L472,641L504,641L505,702C526.343,724.888 541.871,720.914 552,692L529,621C527.331,599.744 537.852,587.724 558,583C581.44,602.063 607.1,649.594 634,713C683.908,741.404 711.475,728.675 713,668C692.504,649.987 668.467,627.064 640,598C626.733,588.492 627.425,577.665 637,566C664.112,550.558 695.134,533.549 730,515C731.407,485.735 724.226,466.397 691,469C662.113,499.62 635.197,521.586 610,536C594.186,537.077 582.219,528.63 578,501C605.997,481.839 632.266,458.342 657,431C665.175,390.325 649.062,373.442 608,381C606.84,384.232 590.607,408.452 549,468C538.858,471.659 529.043,472.117 520,465C524.7,438.098 530.287,411.585 538,386C521.341,362.033 503.626,360.731 485,379C486.898,394.903 485.354,410.9 480,427C474,432.852 466.514,433.187 457,426Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
