// The math keyboard for Physics: vectors, units, constants and the usual formulas, after the everyday symbols
// (a physics paper still needs fractions, powers and roots) and the Greek alphabet.

import { k, type KeyboardTab } from "./keys";
import { basicTab, greekTab } from "./sharedTabs";

const vectorsTab: KeyboardTab = {
  id: "vectors",
  label: "Vectors",
  buttons: [
    k("\\vec{v}", "Velocity vector"),
    k("\\vec{a}", "Acceleration vector"),
    k("\\vec{F}", "Force vector"),
    k("\\vec{P}", "Weight vector"),
    k("\\vec{T}", "Tension vector"),
    k("\\vec{R}", "Reaction vector"),
    k("\\vec{E}", "Electric field vector"),
    k("\\vec{B}", "Magnetic field vector"),
    k("\\vec{g}", "Gravity field vector"),
    k("\\vec{p}", "Momentum vector"),
    k("\\vec{u}", "Vector u"),
    k("\\vec{i}", "Unit vector i"),
    k("\\vec{j}", "Unit vector j"),
    k("\\vec{k}", "Unit vector k"),
    k("\\vec{#?}", "Vector (any letter)"),
    k("\\overrightarrow{#?}", "Vector AB"),
    k("\\left\\Vert\\vec{#?}\\right\\Vert", "Norm"),
    k("\\Delta\\vec{v}", "Change of velocity"),
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
  label: "Units",
  buttons: [
    k("\\,\\mathrm{#?}", "Unit (m, kg, s…)"),
    k("\\times10^{#?}", "× 10ⁿ"),
    k("\\,\\mathrm{m}", "Metre"),
    k("\\,\\mathrm{kg}", "Kilogram"),
    k("\\,\\mathrm{s}", "Second"),
    k("\\,\\mathrm{m\\cdot s^{-1}}", "m·s⁻¹"),
    k("\\,\\mathrm{m\\cdot s^{-2}}", "m·s⁻²"),
    k("\\,\\mathrm{N}", "Newton"),
    k("\\,\\mathrm{J}", "Joule"),
    k("\\,\\mathrm{W}", "Watt"),
    k("\\,\\mathrm{V}", "Volt"),
    k("\\,\\mathrm{A}", "Ampere"),
    k("\\,\\Omega", "Ohm"),
    k("\\,\\mathrm{F}", "Farad"),
    k("\\,\\mathrm{H}", "Henry"),
    k("\\,\\mathrm{C}", "Coulomb"),
    k("\\,\\mathrm{Hz}", "Hertz"),
    k("\\,\\mathrm{Pa}", "Pascal"),
    k("\\,\\mathrm{T}", "Tesla"),
    k("\\,\\mathrm{K}", "Kelvin"),
    k("\\,^{\\circ}\\mathrm{C}", "Degrees Celsius"),
    k("\\,\\mathrm{mol}", "Mole"),
    k("\\,\\mathrm{L}", "Litre"),
    k("\\,\\mathrm{m^{2}}", "m²"),
    k("\\,\\mathrm{m^{3}}", "m³"),
    k("\\,\\mathrm{kg\\cdot m^{-3}}", "kg·m⁻³"),
    k("\\,\\mathrm{N\\cdot kg^{-1}}", "N·kg⁻¹"),
  ],
};

const constantsTab: KeyboardTab = {
  id: "constants",
  label: "Constants",
  buttons: [
    k("g", "Gravitational field strength g"),
    k("G", "Gravitational constant G"),
    k("c", "Speed of light c"),
    k("h", "Planck constant h"),
    k("\\hbar", "Reduced Planck constant ħ"),
    k("k_{B}", "Boltzmann constant k_B"),
    k("N_{A}", "Avogadro constant N_A"),
    k("e", "Elementary charge e"),
    k("R", "Ideal gas constant R"),
    k("\\mathcal{F}", "Faraday constant F"),
    k("\\varepsilon_{0}", "Vacuum permittivity ε₀"),
    k("\\mu_{0}", "Vacuum permeability μ₀"),
    k("m_{e}", "Electron mass"),
    k("m_{p}", "Proton mass"),
    k("m_{n}", "Neutron mass"),
  ],
};

const mechanicsTab: KeyboardTab = {
  id: "mechanics",
  label: "Mechanics",
  buttons: [
    k("v=\\frac{d}{t}", "Speed", { wide: true }),
    k("\\vec{v}=\\frac{\\mathrm{d}\\overrightarrow{OM}}{\\mathrm{d}t}", "Velocity vector", { wide: true }),
    k("\\vec{a}=\\frac{\\mathrm{d}\\vec{v}}{\\mathrm{d}t}", "Acceleration vector", { wide: true }),
    k("\\sum\\vec{F}=m\\vec{a}", "Newton's 2nd law", { wide: true }),
    k("\\vec{P}=m\\vec{g}", "Weight", { wide: true }),
    k("E_{c}=\\frac{1}{2}mv^{2}", "Kinetic energy", { wide: true }),
    k("E_{pp}=mgh", "Gravitational potential energy", { wide: true }),
    k("W\\left(\\vec{F}\\right)=\\vec{F}\\cdot\\overrightarrow{AB}", "Work of a force", { wide: true }),
    k("P=\\frac{W}{\\Delta t}", "Power", { wide: true }),
    k("F=G\\frac{m_{A}m_{B}}{d^{2}}", "Gravitational attraction", { wide: true }),
    k("T=2\\pi\\sqrt{\\frac{m}{k}}", "Spring oscillator period", { wide: true }),
    k("P\\,V=n\\,R\\,T", "Ideal gas law", { wide: true }),
  ],
};

const electricityTab: KeyboardTab = {
  id: "electricity",
  label: "Electricity",
  buttons: [
    k("U=R\\cdot I", "Ohm's law", { wide: true }),
    k("P=U\\cdot I", "Electric power", { wide: true }),
    k("E=R\\,I^{2}\\,\\Delta t", "Joule effect", { wide: true }),
    k("F=k\\frac{\\left|q_{A}q_{B}\\right|}{d^{2}}", "Coulomb's law", { wide: true }),
    k("i=\\frac{\\mathrm{d}q}{\\mathrm{d}t}", "Current", { wide: true }),
    k("q=C\\cdot u_{C}", "Capacitor", { wide: true }),
    k("u_{L}=L\\frac{\\mathrm{d}i}{\\mathrm{d}t}", "Coil", { wide: true }),
    k("\\tau=R\\cdot C", "RC time constant", { wide: true }),
    k("\\tau=\\frac{L}{R}", "RL time constant", { wide: true }),
    k("u_{C}\\left(t\\right)=E\\left(1-e^{-\\frac{t}{\\tau}}\\right)", "Charging a capacitor", { wide: true }),
    k("T_{0}=2\\pi\\sqrt{L\\cdot C}", "LC oscillator period", { wide: true }),
  ],
};

const wavesTab: KeyboardTab = {
  id: "waves",
  label: "Waves & atoms",
  buttons: [
    k("\\lambda=v\\cdot T=\\frac{v}{f}", "Wavelength", { wide: true }),
    k("f=\\frac{1}{T}", "Frequency", { wide: true }),
    k("n=\\frac{c}{v}", "Refractive index", { wide: true }),
    k("n_{1}\\sin i_{1}=n_{2}\\sin i_{2}", "Snell-Descartes law", { wide: true }),
    k("N\\left(t\\right)=N_{0}\\,e^{-\\lambda t}", "Radioactive decay", { wide: true }),
    k("t_{1/2}=\\frac{\\ln 2}{\\lambda}", "Half-life", { wide: true }),
    k("E=m\\,c^{2}", "Mass-energy equivalence", { wide: true }),
    k("\\Delta E=\\left|\\Delta m\\right|\\cdot c^{2}", "Energy released", { wide: true }),
    k("Q=m\\,c\\,\\Delta\\theta", "Heat", { wide: true }),
  ],
};

const chemistryTab: KeyboardTab = {
  id: "chemistry",
  label: "Chemistry",
  buttons: [
    k("\\rightarrow", "Reaction arrow"),
    k("\\rightleftharpoons", "Equilibrium"),
    k("\\xrightarrow{#?}", "Arrow with a condition"),
    k("#@^{#?+}", "Positive ion"),
    k("#@^{#?-}", "Negative ion"),
    k("#@_{\\mathrm{(aq)}}", "Aqueous (aq)"),
    k("#@_{\\mathrm{(s)}}", "Solid (s)"),
    k("#@_{\\mathrm{(l)}}", "Liquid (l)"),
    k("#@_{\\mathrm{(g)}}", "Gas (g)"),
    k("\\mathrm{H_{2}O}", "Water"),
    k("\\mathrm{CO_{2}}", "Carbon dioxide"),
    k("\\mathrm{O_{2}}", "Dioxygen"),
    k("\\mathrm{H_{3}O^{+}}", "Oxonium ion"),
    k("\\mathrm{HO^{-}}", "Hydroxide ion"),
    k("\\left[\\mathrm{#?}\\right]", "Concentration [X]"),
    k("\\mathrm{pH}", "pH"),
    k("K_{a}", "Acidity constant Ka"),
    k("\\mathrm{p}K_{a}", "pKa"),
    k("x_{\\max}", "Maximum advancement"),
    k("\\,\\mathrm{mol\\cdot L^{-1}}", "mol·L⁻¹"),
    k("\\,\\mathrm{g\\cdot mol^{-1}}", "g·mol⁻¹"),
    k("n=\\frac{m}{M}", "Amount of substance", { wide: true }),
    k("C=\\frac{n}{V}", "Concentration", { wide: true }),
    k("\\mathrm{pH}=-\\log\\left[\\mathrm{H_{3}O^{+}}\\right]", "pH formula", { wide: true }),
    k("K=\\frac{\\left[\\mathrm{#?}\\right]}{\\left[\\mathrm{#?}\\right]}", "Equilibrium constant", { wide: true }),
  ],
};

export const physicsTabs: KeyboardTab[] = [basicTab, vectorsTab, greekTab, unitsTab, constantsTab, mechanicsTab, electricityTab, wavesTab, chemistryTab];
