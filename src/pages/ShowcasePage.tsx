import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownOption } from "@/components/atoms/Dropdown";
import { Button, Toggle, Dropdown } from "@/components/atoms";
import { Heading, Text, Label } from "@/components/atoms";
import { cn } from "@/lib/utils";

/**
 * @page ShowcasePage
 * @description Design system showcase — displays all tokens and components
 * @route /showcase
 */

type Section =
  | "colors"
  | "typography"
  | "spacing"
  | "radius"
  | "shadows"
  | "buttons"
  | "toggles"
  | "dropdowns";

const COLORS = [
  // Text Colors
  { name: "color-text-primary", value: "#f2eef9" },
  { name: "color-text-secondary", value: "#baafd9" },
  { name: "color-text-muted", value: "#8b7aaa" },
  { name: "color-text-disabled", value: "#4a3d6a" },
  { name: "color-text-accent", value: "#76e900" },
  { name: "color-text-inverse", value: "#0a0514" },

  // Background Colors
  { name: "color-bg-page", value: "#0a0514" },
  { name: "color-surface-raised", value: "#130d21" },
  { name: "color-surface-overlay", value: "#1d1535" },
  { name: "color-surface-floating", value: "#271d45" },

  // Border Colors
  { name: "color-border-subtle", value: "#1d1535" },
  { name: "color-border-default", value: "#2d1b4d" },
  { name: "color-border-strong", value: "#4b2a96" },
  { name: "color-border-accent", value: "#76e900" },

  // Interactive Colors
  { name: "color-interactive-primary", value: "#76e900" },
  { name: "color-interactive-primary-hover", value: "#8fff10" },
  { name: "color-interactive-primary-active", value: "#5bbb00" },
  { name: "color-interactive-secondary", value: "#2d1b4d" },

  // State Colors
  { name: "color-error-base", value: "#ff4d6a" },
  { name: "color-warning-base", value: "#ffb830" },
  { name: "color-info-base", value: "#4dc8ff" },
  { name: "color-success-text", value: "#00e5a0" },
];

const TYPOGRAPHY = [
  { name: "type-heading-xl", size: "2rem", weight: 700 },
  { name: "type-heading-lg", size: "1.5rem", weight: 700 },
  { name: "type-heading-md", size: "1.25rem", weight: 700 },
  { name: "type-heading-sm", size: "1rem", weight: 700 },
  { name: "type-button", size: "0.875rem", weight: 600 },
  { name: "type-label", size: "0.75rem", weight: 600 },
  { name: "type-caption", size: "0.75rem", weight: 500 },
  { name: "type-body-md", size: "1rem", weight: 400 },
  { name: "type-body-sm", size: "0.875rem", weight: 400 },
];

const SPACING = [
  { name: "spacing-2", value: "0.5rem", px: 8 },
  { name: "spacing-3", value: "0.75rem", px: 12 },
  { name: "spacing-4", value: "1rem", px: 16 },
  { name: "spacing-6", value: "1.5rem", px: 24 },
  { name: "spacing-8", value: "2rem", px: 32 },
  { name: "spacing-12", value: "3rem", px: 48 },
];

const RADIUS = [
  { name: "radius-sm", value: "0.5rem" },
  { name: "radius-md", value: "0.75rem" },
  { name: "radius-lg", value: "1rem" },
  { name: "radius-xl", value: "1.5rem" },
  { name: "radius-full", value: "9999px" },
];

const SHADOWS = [
  { name: "shadow-sm", style: "0 1px 2px rgba(0,0,0,0.05)" },
  { name: "shadow-md", style: "0 4px 6px rgba(0,0,0,0.1)" },
  { name: "shadow-lg", style: "0 10px 15px rgba(0,0,0,0.1)" },
  { name: "shadow-xl", style: "0 20px 25px rgba(0,0,0,0.1)" },
  { name: "shadow-2xl", style: "0 25px 50px rgba(0,0,0,0.25)" },
  { name: "shadow-glow-sm", style: "0 0 10px rgba(118,233,0,0.3)" },
  { name: "shadow-glow-md", style: "0 0 15px rgba(118,233,0,0.5)" },
  { name: "shadow-glow-lg", style: "0 0 20px rgba(118,233,0,0.5)" },
  { name: "shadow-glow-xl", style: "0 0 40px rgba(118,233,0,0.3)" },
];

export const ShowcasePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>("colors");
  const [selectedDropdown, setSelectedDropdown] = useState<string[]>([]);

  const dropdownOptions: DropdownOption[] = [
    { id: "opt1", name: "Option 1" },
    { id: "opt2", name: "Option 2" },
    { id: "opt3", name: "Option 3" },
  ];

  return (
    <div className="min-h-screen bg-plaeen-dark text-white">
      {/* Header */}
      <div className="bg-linear-to-b from-plaeen-dark/50 to-transparent border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-spacing-8 py-spacing-8">
          <Heading level={1} className="text-3xl">
            Design System Showcase
          </Heading>
          <Text className="text-white/60 mt-2">
            Live reference for all tokens and components
          </Text>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white/5 border-r border-white/10 sticky left-0 top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-spacing-6 space-y-2">
            <NavItem
              section="colors"
              label="Colors"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="typography"
              label="Typography"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="spacing"
              label="Spacing"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="radius"
              label="Radius"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="shadows"
              label="Shadows"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="buttons"
              label="Buttons"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="toggles"
              label="Toggles"
              active={activeSection}
              onClick={setActiveSection}
            />
            <NavItem
              section="dropdowns"
              label="Dropdowns"
              active={activeSection}
              onClick={setActiveSection}
            />
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-spacing-8 p-12">
          <div className="max-w-4xl">
            {activeSection === "colors" && (
              <Section title="Color Variables">
                <div className="grid grid-cols-2 gap-spacing-6">
                  {COLORS.map((color) => (
                    <div
                      key={color.name}
                      className="flex items-center gap-spacing-4"
                    >
                      <div
                        className="w-16 h-16 rounded-radius-lg border border-white/10 shrink-0"
                        style={{ backgroundColor: color.value }}
                      />
                      <div className="min-w-0">
                        <Label className="text-white">{color.name}</Label>
                        <Text className="text-white/40 text-sm font-mono">
                          {color.value}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {activeSection === "typography" && (
              <Section title="Typography">
                <div className="space-y-spacing-6">
                  {TYPOGRAPHY.map((type) => (
                    <div key={type.name}>
                      <div
                        style={{ fontSize: type.size, fontWeight: type.weight }}
                      >
                        The quick brown fox jumps over the lazy dog
                      </div>
                      <Label className="text-white/40 mt-spacing-2">
                        {type.name} • {type.size} • weight {type.weight}
                      </Label>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {activeSection === "spacing" && (
              <Section title="Spacing Tokens">
                <div className="space-y-spacing-6">
                  {SPACING.map((space) => (
                    <div
                      key={space.name}
                      className="flex items-end gap-spacing-4"
                    >
                      <div
                        className="bg-plaeen-green/20 border border-plaeen-green rounded-radius-sm shrink-0"
                        style={{ width: space.px, height: space.px }}
                      />
                      <div>
                        <Label className="text-white">{space.name}</Label>
                        <Text className="text-white/40 text-sm">
                          {space.value} ({space.px}px)
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {activeSection === "radius" && (
              <Section title="Radius Tokens">
                <div className="grid grid-cols-2 gap-spacing-6">
                  {RADIUS.map((radius) => (
                    <div
                      key={radius.name}
                      className="flex items-center gap-spacing-4"
                    >
                      <div
                        className="w-16 h-16 bg-plaeen-green/20 border border-plaeen-green shrink-0"
                        style={{ borderRadius: radius.value }}
                      />
                      <div>
                        <Label className="text-white">{radius.name}</Label>
                        <Text className="text-white/40 text-sm">
                          {radius.value}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {activeSection === "shadows" && (
              <Section title="Shadow Tokens">
                <div className="space-y-spacing-6">
                  {SHADOWS.map((shadow) => (
                    <div
                      key={shadow.name}
                      className="p-spacing-6 bg-white/5 rounded-radius-lg border border-white/10"
                      style={{ boxShadow: shadow.style }}
                    >
                      <Label className="text-white">{shadow.name}</Label>
                      <Text className="text-white/40 text-sm font-mono mt-spacing-2">
                        {shadow.style}
                      </Text>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {activeSection === "buttons" && (
              <Section title="Button Component">
                <div className="space-y-12! gap-y-8">
                  {/* Variants */}
                  <div className="space-y-4 mt-6!">
                    <Heading level={3} variant="section">
                      Variants
                    </Heading>
                    <div className="flex flex-wrap space-6 gap-x-6 mt-6">
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="md">
                          Primary
                        </Button>
                        <Text className="text-xs text-white/40">primary</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="secondary" size="md">
                          Secondary
                        </Button>
                        <Text className="text-xs text-white/40">secondary</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="outline" size="md">
                          Outline
                        </Button>
                        <Text className="text-xs text-white/40">outline</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="ghost" size="md">
                          Ghost
                        </Button>
                        <Text className="text-xs text-white/40">ghost</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="tertiary" size="md">
                          Tertiary
                        </Button>
                        <Text className="text-xs text-white/40">tertiary</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="remove" size="md">
                          Remove
                        </Button>
                        <Text className="text-xs text-white/40">remove</Text>
                      </div>
                    </div>
                  </div>

                  {/* States */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-6">
                      States
                    </Heading>
                    <div className="flex flex-wrap gap-spacing-6">
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="md">
                          Default
                        </Button>
                        <Text className="text-xs text-white/40">
                          default (interactive)
                        </Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="md" disabled>
                          Disabled
                        </Button>
                        <Text className="text-xs text-white/40">disabled</Text>
                      </div>
                    </div>
                    <Text className="text-white/40 text-sm mt-spacing-4">
                      Hover and active states are interactive — try clicking
                    </Text>
                  </div>

                  {/* Sizes */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-6">
                      Sizes
                    </Heading>
                    <div className="flex flex-wrap items-end gap-spacing-6">
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="sm">
                          Small
                        </Button>
                        <Text className="text-xs text-white/40">sm</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="md">
                          Medium
                        </Button>
                        <Text className="text-xs text-white/40">md</Text>
                      </div>
                      <div className="flex flex-col gap-spacing-2">
                        <Button variant="primary" size="lg">
                          Large
                        </Button>
                        <Text className="text-xs text-white/40">lg</Text>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {activeSection === "toggles" && (
              <Section title="Toggle Component">
                <div className="space-y-spacing-12">
                  {/* States */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-6">
                      States
                    </Heading>
                    <div className="flex flex-wrap gap-spacing-8">
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="on" size="md" />
                          <Text>On</Text>
                        </div>
                        <Text className="text-xs text-white/40">
                          state="on"
                        </Text>
                      </div>
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="off" size="md" />
                          <Text>Off</Text>
                        </div>
                        <Text className="text-xs text-white/40">
                          state="off"
                        </Text>
                      </div>
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="on" size="md" disabled />
                          <Text>Disabled</Text>
                        </div>
                        <Text className="text-xs text-white/40">disabled</Text>
                      </div>
                    </div>
                  </div>

                  {/* Sizes */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-6">
                      Sizes
                    </Heading>
                    <div className="flex flex-wrap items-center gap-spacing-8">
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="on" size="sm" />
                          <Text className="text-sm">Small</Text>
                        </div>
                        <Text className="text-xs text-white/40">sm</Text>
                      </div>
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="on" size="md" />
                          <Text className="text-sm">Medium</Text>
                        </div>
                        <Text className="text-xs text-white/40">md</Text>
                      </div>
                      <div>
                        <div className="flex items-center gap-spacing-3 mb-spacing-2">
                          <Toggle state="on" size="lg" />
                          <Text className="text-sm">Large</Text>
                        </div>
                        <Text className="text-xs text-white/40">lg</Text>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {activeSection === "dropdowns" && (
              <Section title="Dropdown Component">
                <div className="space-y-spacing-8">
                  {/* Filter variant */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-4">
                      Filter Variant
                    </Heading>
                    <div className="flex gap-spacing-4">
                      <Dropdown
                        variant="filter"
                        label="Filter"
                        options={dropdownOptions}
                        selectedIds={selectedDropdown}
                        onSelectionChange={setSelectedDropdown}
                        isMultiple
                        showApplyButton
                        showResetButton
                      />
                    </div>
                  </div>

                  {/* Sort variant */}
                  <div>
                    <Heading level={3} className="text-lg mb-spacing-4">
                      Sort Variant
                    </Heading>
                    <div className="flex gap-spacing-4">
                      <Dropdown
                        variant="sort"
                        label="Sort by Name"
                        options={dropdownOptions}
                        selectedIds={selectedDropdown}
                        onSelectionChange={setSelectedDropdown}
                        isMultiple={false}
                      />
                    </div>
                  </div>

                  <Text className="text-white/40 text-sm mt-spacing-4">
                    (Click to open and interact with the dropdown)
                  </Text>
                </div>
              </Section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

function NavItem({
  section,
  label,
  active,
  onClick,
}: {
  section: Section;
  label: string;
  active: Section;
  onClick: (section: Section) => void;
}) {
  return (
    <button
      onClick={() => onClick(section)}
      className={cn(
        "w-full text-left px-spacing-4 py-spacing-3 rounded-radius-md transition-colors text-sm",
        active === section
          ? "bg-plaeen-green text-black font-bold"
          : "text-white/60 hover:text-white hover:bg-white/10",
      )}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Heading level={2} variant="section" color="accent" className="mb-8">
        {title}
      </Heading>
      {children}
    </div>
  );
}
