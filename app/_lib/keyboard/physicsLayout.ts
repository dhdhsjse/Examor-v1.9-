// The math keyboard for Physics: vectors, units, constants and chemistry signs, after the everyday symbols (a physics paper still
// needs fractions, powers and roots) and the Greek alphabet, then the best-known laws in one Formulas tab, by field.
//
// Everywhere but the Formulas tab, only building blocks: no vector key per letter (one "vector" key takes any letter) and no constant
// that is just a letter (g, c, h…).

import { f, groupedTab, k, type KeyboardTab } from "./keys";
import { basicTab, greekTab } from "./sharedTabs";

const vectorsTab: KeyboardTab = {
  id: "vectors",
  label: "Vectors",
  buttons: [
    k("\\vec{#?}", "Vector (any letter)"),
    k("\\overrightarrow{#?}", "Vector AB"),
    k("\\left\\Vert\\vec{#?}\\right\\Vert", "Norm"),
    k("\\frac{\\mathrm{d}\\vec{#?}}{\\mathrm{d}t}", "Derivative with time"),
    k("\\dot{#@}", "Time derivative"),
    k("\\ddot{#@}", "Second time derivative"),
    k("\\vec{#?}\\cdot\\vec{#?}", "Dot product"),
    k("\\vec{#?}\\wedge\\vec{#?}", "Cross product"),
    k("\\begin{pmatrix}#?\\\\#?\\end{pmatrix}", "Column vector"),
    k("\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}", "Column vector (3 coordinates)"),
  ],
};

// A unit comes after a number, so each starts with a thin space.
const unitsTab: KeyboardTab = {
  id: "units",
  label: "Units & constants",
  buttons: [
    k("\\,\\mathrm{#?}", "Unit (m, kg, s…)"),
    k("\\times10^{#?}", "× 10ⁿ"),
    k("\\,\\mathrm{m\\cdot s^{-1}}", "m·s⁻¹"),
    k("\\,\\mathrm{m\\cdot s^{-2}}", "m·s⁻²"),
    k("\\,\\Omega", "Ohm"),
    k("\\,^{\\circ}\\mathrm{C}", "Degrees Celsius"),
    k("\\hbar", "Reduced Planck constant ħ"),
    k("k_{B}", "Boltzmann constant k_B"),
    k("N_{A}", "Avogadro constant N_A"),
    k("\\varepsilon_{0}", "Vacuum permittivity ε₀"),
    k("\\mu_{0}", "Vacuum permeability μ₀"),
  ],
};

const chemistryTab: KeyboardTab = {
  id: "chemistry",
  label: "Chemistry",
  buttons: [
    k("\\mathrm{#?}", "Chemical formula (upright letters)"),
    k("\\rightarrow", "Reaction arrow"),
    k("\\rightleftharpoons", "Equilibrium"),
    k("\\xrightarrow{#?}", "Arrow with a condition"),
    k("#@^{#?+}", "Positive ion"),
    k("#@^{#?-}", "Negative ion"),
    k("#@_{\\mathrm{(aq)}}", "Aqueous (aq)"),
    k("#@_{\\mathrm{(s)}}", "Solid (s)"),
    k("#@_{\\mathrm{(l)}}", "Liquid (l)"),
    k("#@_{\\mathrm{(g)}}", "Gas (g)"),
    k("\\left[\\mathrm{#?}\\right]", "Concentration [X]"),
    k("\\mathrm{pH}", "pH"),
    k("\\mathrm{p}K_{a}", "pKa"),
    k("\\,\\mathrm{mol\\cdot L^{-1}}", "mol·L⁻¹"),
    k("\\,\\mathrm{g\\cdot mol^{-1}}", "g·mol⁻¹"),
  ],
};

// The best-known laws of the secondary-school programme, all in one tab, by field: the teacher picks Mechanics, Electricity… under the
// tabs. Only here: the other tabs keep building blocks.
const formulasTab = groupedTab("formulas", "Formulas", [
  {
    id: "mechanics",
    label: "Mechanics",
    buttons: [
      f("v=\\frac{d}{\\Delta t}", "Speed"),
      f("\\vec{v}=\\frac{\\mathrm{d}\\overrightarrow{OM}}{\\mathrm{d}t}", "Velocity vector"),
      f("\\vec{a}=\\frac{\\mathrm{d}\\vec{v}}{\\mathrm{d}t}", "Acceleration vector"),
      f("\\sum\\vec{F}_{\\mathrm{ext}}=m\\vec{a}", "Newton's 2nd law"),
      f("\\vec{P}=m\\vec{g}", "Weight"),
      f("\\vec{p}=m\\vec{v}", "Momentum"),
      f("F=G\\frac{m_{A}m_{B}}{d^{2}}", "Gravitational attraction"),
      f("E_{c}=\\frac{1}{2}mv^{2}", "Kinetic energy"),
      f("E_{pp}=mgz", "Gravitational potential energy"),
      f("E_{m}=E_{c}+E_{p}", "Mechanical energy"),
      f("W_{AB}\\left(\\vec{F}\\right)=\\vec{F}\\cdot\\overrightarrow{AB}", "Work of a force"),
      f("\\mathcal{P}=\\frac{W}{\\Delta t}", "Power"),
      f("T_{0}=2\\pi\\sqrt{\\frac{m}{k}}", "Spring oscillator period"),
      f("T_{0}=2\\pi\\sqrt{\\frac{\\ell}{g}}", "Simple pendulum period"),
    ],
  },
  {
    id: "electricity",
    label: "Electricity",
    buttons: [
      f("U=R\\,I", "Ohm's law"),
      f("\\mathcal{P}=U\\,I", "Electric power"),
      f("E=R\\,I^{2}\\,\\Delta t", "Joule effect"),
      f("R_{\\mathrm{eq}}=R_{1}+R_{2}", "Resistors in series"),
      f("F=k\\frac{\\left|q_{A}q_{B}\\right|}{d^{2}}", "Coulomb's law"),
      f("i=\\frac{\\mathrm{d}q}{\\mathrm{d}t}", "Current"),
      f("q=C\\,u_{C}", "Capacitor"),
      f("E_{e}=\\frac{1}{2}C\\,u_{C}^{2}", "Energy in a capacitor"),
      f("u_{L}=L\\frac{\\mathrm{d}i}{\\mathrm{d}t}+r\\,i", "Coil"),
      f("\\tau=R\\,C", "RC time constant"),
      f("\\tau=\\frac{L}{R}", "RL time constant"),
      f("u_{C}\\left(t\\right)=E\\left(1-e^{-\\frac{t}{\\tau}}\\right)", "Charging a capacitor"),
      f("T_{0}=2\\pi\\sqrt{L\\,C}", "LC oscillator period"),
    ],
  },
  {
    id: "waves",
    label: "Waves & optics",
    buttons: [
      f("\\lambda=v\\,T=\\frac{v}{f}", "Wavelength"),
      f("f=\\frac{1}{T}", "Frequency"),
      f("v=\\frac{d}{\\tau}", "Speed of a wave"),
      f("n=\\frac{c}{v}", "Refractive index"),
      f("n_{1}\\sin i_{1}=n_{2}\\sin i_{2}", "Snell-Descartes law"),
      f("\\theta=\\frac{\\lambda}{a}", "Diffraction"),
      f("\\frac{1}{\\overline{OA'}}-\\frac{1}{\\overline{OA}}=\\frac{1}{f'}", "Thin lens equation"),
      f("\\gamma=\\frac{\\overline{A'B'}}{\\overline{AB}}", "Magnification"),
    ],
  },
  {
    id: "nuclear",
    label: "Atoms & energy",
    buttons: [
      f("E=h\\,\\nu=\\frac{h\\,c}{\\lambda}", "Photon energy"),
      f("N\\left(t\\right)=N_{0}\\,e^{-\\lambda t}", "Radioactive decay"),
      f("t_{1/2}=\\frac{\\ln 2}{\\lambda}", "Half-life"),
      f("A=\\lambda\\,N", "Activity"),
      f("E=m\\,c^{2}", "Mass-energy equivalence"),
      f("\\Delta E=\\left|\\Delta m\\right|c^{2}", "Energy released"),
      f("Q=m\\,c\\,\\Delta\\theta", "Heat"),
      f("P\\,V=n\\,R\\,T", "Ideal gas law"),
    ],
  },
  {
    id: "chemistry",
    label: "Chemistry",
    buttons: [
      f("n=\\frac{m}{M}", "Amount of substance"),
      f("C=\\frac{n}{V}", "Concentration"),
      f("n=\\frac{V}{V_{m}}", "Amount of gas"),
      f("C_{m}=\\frac{m}{V}", "Mass concentration"),
      f("\\mathrm{pH}=-\\log\\left[\\mathrm{H_{3}O^{+}}\\right]", "pH formula"),
      f("\\mathrm{p}K_{a}=-\\log K_{a}", "pKa formula"),
      f("\\mathrm{pH}=\\mathrm{p}K_{a}+\\log\\frac{\\left[\\mathrm{A^{-}}\\right]}{\\left[\\mathrm{AH}\\right]}", "pH and pKa"),
      f("\\tau=\\frac{x_{f}}{x_{\\max}}", "Final advancement ratio"),
    ],
  },
]);

export const physicsTabs: KeyboardTab[] = [basicTab, vectorsTab, unitsTab, chemistryTab, greekTab, formulasTab];
