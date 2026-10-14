/**
 * Built-in simulation catalog: curated PhET Interactive Simulations (HTML5, run in any browser, embeddable).
 * Every URL follows https://phet.colorado.edu/sims/html/<slug>/latest/<slug>_all.html and was checked to
 * return 200 (October 2026). Topics use common chapter names so teachers can search by what they teach.
 *
 * Licence: PhET simulations are © University of Colorado Boulder, licensed CC-BY 4.0.
 * Attribution shown in the UI: "PhET Interactive Simulations, University of Colorado Boulder, https://phet.colorado.edu".
 */
import type { Simulation } from '@classiq/shared';

export const PHET_ATTRIBUTION =
  'PhET Interactive Simulations, University of Colorado Boulder (CC-BY 4.0), https://phet.colorado.edu';

export const SIMULATION_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Earth science',
] as const;
type Subject = (typeof SIMULATION_SUBJECTS)[number];

const phet = (
  slug: string,
  title: string,
  subject: Subject,
  topics: string[],
  description: string,
): Simulation => ({
  id: `phet:${slug}`,
  title,
  subject,
  topics,
  url: `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_all.html`,
  source: 'catalog',
  description,
});

export const SIMULATION_CATALOG: readonly Simulation[] = [
  /* ------------------------------- Physics ------------------------------- */
  phet(
    'ohms-law',
    "Ohm's Law",
    'Physics',
    ["Ohm's law", 'Electricity', 'Current', 'Resistance', 'Voltage'],
    'See how voltage and resistance change the current in a circuit (V = IR).',
  ),
  phet(
    'circuit-construction-kit-dc',
    'Circuit Construction Kit: DC',
    'Physics',
    ['Electricity', 'Electric circuits', 'Series and parallel circuits', "Ohm's law"],
    'Build circuits with batteries, bulbs, resistors and switches; measure with an ammeter and voltmeter.',
  ),
  phet(
    'circuit-construction-kit-ac',
    'Circuit Construction Kit: AC',
    'Physics',
    ['Alternating current', 'Capacitors', 'Inductors', 'Electric circuits'],
    'Build AC and DC circuits with capacitors and inductors and watch current and voltage change.',
  ),
  phet(
    'resistance-in-a-wire',
    'Resistance in a Wire',
    'Physics',
    ['Resistance', 'Resistivity', 'Electricity'],
    'Change the length, area and resistivity of a wire and see the resistance change (R = ρL/A).',
  ),
  phet(
    'forces-and-motion-basics',
    'Forces and Motion: Basics',
    'Physics',
    ["Newton's laws of motion", 'Force', 'Friction', 'Motion'],
    'Push objects, add friction and explore net force, balanced and unbalanced forces.',
  ),
  phet(
    'friction',
    'Friction',
    'Physics',
    ['Friction', 'Heat', 'Force'],
    'Rub two surfaces together and watch the atoms heat up and break away.',
  ),
  phet(
    'projectile-motion',
    'Projectile Motion',
    'Physics',
    ['Projectile motion', 'Motion in a plane', 'Kinematics', 'Vectors'],
    'Launch objects and explore how angle, speed and air resistance change range and height.',
  ),
  phet(
    'vector-addition',
    'Vector Addition',
    'Physics',
    ['Vectors', 'Motion in a plane', 'Kinematics'],
    'Add vectors graphically and by components.',
  ),
  phet(
    'collision-lab',
    'Collision Lab',
    'Physics',
    ['Momentum', 'Conservation of momentum', 'Collisions', 'Laws of motion'],
    'Collide balls in one and two dimensions; explore elastic and inelastic collisions.',
  ),
  phet(
    'energy-skate-park-basics',
    'Energy Skate Park: Basics',
    'Physics',
    ['Work and energy', 'Conservation of energy', 'Kinetic energy', 'Potential energy'],
    'A skater on a track shows kinetic, potential and thermal energy changing.',
  ),
  phet(
    'energy-skate-park',
    'Energy Skate Park',
    'Physics',
    ['Work, energy and power', 'Conservation of energy', 'Friction'],
    'Build tracks and analyse energy with graphs, friction and different gravity.',
  ),
  phet(
    'energy-forms-and-changes',
    'Energy Forms and Changes',
    'Physics',
    ['Energy', 'Energy transformation', 'Heat', 'Sources of energy'],
    'Heat and cool objects and build energy systems to see energy flow and change form.',
  ),
  phet(
    'pendulum-lab',
    'Pendulum Lab',
    'Physics',
    ['Oscillations', 'Simple pendulum', 'Simple harmonic motion', 'Time period'],
    'Change length, mass and gravity and measure the period of a pendulum.',
  ),
  phet(
    'masses-and-springs',
    'Masses and Springs',
    'Physics',
    ['Oscillations', "Hooke's law", 'Simple harmonic motion', 'Elasticity'],
    'Hang masses from springs and explore oscillation, energy and spring constant.',
  ),
  phet(
    'hookes-law',
    "Hooke's Law",
    'Physics',
    ["Hooke's law", 'Elasticity', 'Mechanical properties of solids'],
    'Stretch and compress springs; explore F = kx and springs in series and parallel.',
  ),
  phet(
    'wave-on-a-string',
    'Wave on a String',
    'Physics',
    ['Waves', 'Wavelength and frequency', 'Standing waves'],
    'Wiggle a string to make waves; adjust amplitude, frequency, damping and tension.',
  ),
  phet(
    'waves-intro',
    'Waves Intro',
    'Physics',
    ['Waves', 'Sound', 'Light'],
    'Make water, sound and light waves and compare their properties.',
  ),
  phet(
    'wave-interference',
    'Wave Interference',
    'Physics',
    ['Interference', 'Diffraction', 'Wave optics', "Young's double slit"],
    'Make waves with taps, speakers and lasers and watch them interfere and diffract.',
  ),
  phet(
    'sound-waves',
    'Sound Waves',
    'Physics',
    ['Sound', 'Waves', 'Pitch and loudness'],
    'See and hear sound waves; explore frequency, amplitude, reflection and interference.',
  ),
  phet(
    'bending-light',
    'Bending Light',
    'Physics',
    ['Refraction of light', "Snell's law", 'Total internal reflection', 'Light'],
    'Shine a laser through materials and prisms to explore reflection and refraction.',
  ),
  phet(
    'geometric-optics',
    'Geometric Optics',
    'Physics',
    ['Lenses', 'Mirrors', 'Ray optics', 'Image formation'],
    'See how lenses and mirrors form images; change focal length and object position.',
  ),
  phet(
    'color-vision',
    'Color Vision',
    'Physics',
    ['Light', 'Colour', 'Human eye'],
    'Mix coloured lights and filters to see how we perceive colour.',
  ),
  phet(
    'blackbody-spectrum',
    'Blackbody Spectrum',
    'Physics',
    ['Thermal radiation', 'Blackbody radiation', "Wien's law"],
    'See how the spectrum of a hot object changes with temperature.',
  ),
  phet(
    'models-of-the-hydrogen-atom',
    'Models of the Hydrogen Atom',
    'Physics',
    ['Atoms', 'Bohr model', 'Atomic spectra', 'Modern physics'],
    'Compare atomic models (Rutherford, Bohr, de Broglie, Schrödinger) with experiment.',
  ),
  phet(
    'gravity-force-lab',
    'Gravity Force Lab',
    'Physics',
    ['Gravitation', "Newton's law of gravitation"],
    'Change masses and distance and see the gravitational force between them.',
  ),
  phet(
    'coulombs-law',
    "Coulomb's Law",
    'Physics',
    ["Coulomb's law", 'Electric charges and fields', 'Electrostatics'],
    'Change charges and distance and measure the electrostatic force.',
  ),
  phet(
    'charges-and-fields',
    'Charges and Fields',
    'Physics',
    ['Electric charges and fields', 'Electric potential', 'Equipotential surfaces'],
    'Place charges and see electric field lines and equipotentials.',
  ),
  phet(
    'balloons-and-static-electricity',
    'Balloons and Static Electricity',
    'Physics',
    ['Static electricity', 'Electric charge', 'Electrostatics'],
    'Rub a balloon on a sweater and see charge transfer and attraction.',
  ),
  phet(
    'john-travoltage',
    'John Travoltage',
    'Physics',
    ['Static electricity', 'Electric discharge', 'Electric charge'],
    'Build up charge by rubbing a foot on a carpet, then discharge it with a spark.',
  ),
  phet(
    'capacitor-lab-basics',
    'Capacitor Lab: Basics',
    'Physics',
    ['Capacitance', 'Capacitors', 'Electrostatic potential'],
    'Change plate area and separation and see capacitance, charge and stored energy.',
  ),
  phet(
    'faradays-electromagnetic-lab',
    "Faraday's Electromagnetic Lab",
    'Physics',
    ['Electromagnetic induction', "Faraday's law", 'Magnetism', 'Generators and transformers'],
    'Explore magnets, coils, electromagnets, generators and transformers.',
  ),
  phet(
    'density',
    'Density',
    'Physics',
    ['Density', 'Mass and volume', 'Matter'],
    'Measure mass and volume of blocks and find what makes things float or sink.',
  ),
  phet(
    'buoyancy',
    'Buoyancy',
    'Physics',
    ['Buoyancy', "Archimedes' principle", 'Floating and sinking', 'Fluids'],
    'Explore buoyant force, displaced fluid and why objects float.',
  ),
  phet(
    'under-pressure',
    'Under Pressure',
    'Physics',
    ['Pressure', 'Fluid pressure', 'Mechanical properties of fluids'],
    'Explore pressure in liquids and air; change fluid density and gravity.',
  ),
  phet(
    'gas-properties',
    'Gas Properties',
    'Physics',
    ['Kinetic theory of gases', 'Gas laws', 'Pressure', 'Temperature'],
    'Pump gas into a box and explore pressure, volume, temperature and particle speed.',
  ),
  phet(
    'fourier-making-waves',
    'Fourier: Making Waves',
    'Physics',
    ['Fourier series', 'Waves', 'Harmonics'],
    'Build complex waves by adding sine waves (harmonics).',
  ),

  /* ------------------------------- Chemistry ------------------------------- */
  phet(
    'build-an-atom',
    'Build an Atom',
    'Chemistry',
    ['Structure of the atom', 'Protons, neutrons and electrons', 'Atomic number and mass number', 'Ions'],
    'Build atoms from protons, neutrons and electrons; see element, charge and mass.',
  ),
  phet(
    'isotopes-and-atomic-mass',
    'Isotopes and Atomic Mass',
    'Chemistry',
    ['Isotopes', 'Atomic mass', 'Structure of the atom'],
    'Make isotopes and find average atomic mass from natural abundance.',
  ),
  phet(
    'states-of-matter-basics',
    'States of Matter: Basics',
    'Chemistry',
    ['States of matter', 'Matter in our surroundings', 'Melting and boiling'],
    'Heat and cool atoms and molecules and watch solids, liquids and gases change.',
  ),
  phet(
    'states-of-matter',
    'States of Matter',
    'Chemistry',
    ['States of matter', 'Phase changes', 'Phase diagrams', 'Intermolecular forces'],
    'Explore phase changes, phase diagrams and interaction potential.',
  ),
  phet(
    'atomic-interactions',
    'Atomic Interactions',
    'Chemistry',
    ['Chemical bonding', 'Intermolecular forces', 'Potential energy'],
    'See the attractive and repulsive forces between atoms.',
  ),
  phet(
    'molecule-shapes',
    'Molecule Shapes',
    'Chemistry',
    ['VSEPR theory', 'Chemical bonding and molecular structure', 'Molecular geometry'],
    'Build molecules in 3D and see how electron pairs set the shape (VSEPR).',
  ),
  phet(
    'molecule-polarity',
    'Molecule Polarity',
    'Chemistry',
    ['Polarity', 'Electronegativity', 'Chemical bonding'],
    'Change electronegativity and see bond and molecular polarity.',
  ),
  phet(
    'build-a-molecule',
    'Build a Molecule',
    'Chemistry',
    ['Molecules', 'Chemical formulae', 'Atoms and molecules'],
    'Build molecules from atoms and learn how formulae are written.',
  ),
  phet(
    'balancing-chemical-equations',
    'Balancing Chemical Equations',
    'Chemistry',
    ['Chemical reactions and equations', 'Balancing equations', 'Conservation of mass'],
    'Balance equations and see that atoms are conserved.',
  ),
  phet(
    'reactants-products-and-leftovers',
    'Reactants, Products and Leftovers',
    'Chemistry',
    ['Stoichiometry', 'Limiting reagent', 'Chemical reactions'],
    'Make sandwiches and molecules to understand limiting reactants.',
  ),
  phet(
    'ph-scale',
    'pH Scale',
    'Chemistry',
    ['Acids and bases', 'pH scale', 'Acids, bases and salts', 'Ionic equilibrium'],
    'Test everyday liquids, add water and see pH, H3O+ and OH− concentrations.',
  ),
  phet(
    'ph-scale-basics',
    'pH Scale: Basics',
    'Chemistry',
    ['Acids and bases', 'pH scale', 'Acids, bases and salts'],
    'Test the pH of everyday liquids and see how dilution changes it.',
  ),
  phet(
    'acid-base-solutions',
    'Acid-Base Solutions',
    'Chemistry',
    ['Acids and bases', 'Strong and weak acids', 'Ionic equilibrium'],
    'Compare strong and weak acids and bases at the molecular level.',
  ),
  phet(
    'concentration',
    'Concentration',
    'Chemistry',
    ['Solutions', 'Concentration', 'Saturation'],
    'Add solute and water and see concentration and saturation change.',
  ),
  phet(
    'molarity',
    'Molarity',
    'Chemistry',
    ['Solutions', 'Molarity', 'Mole concept'],
    'Change moles of solute and volume and see molarity change.',
  ),
  phet(
    'beers-law-lab',
    "Beer's Law Lab",
    'Chemistry',
    ["Beer's law", 'Solutions', 'Absorbance'],
    'Shine light through solutions and relate absorbance to concentration.',
  ),
  phet(
    'diffusion',
    'Diffusion',
    'Chemistry',
    ['Diffusion', 'Kinetic theory', 'Matter in our surroundings'],
    'Remove a divider and watch particles of two gases mix.',
  ),
  phet(
    'molecules-and-light',
    'Molecules and Light',
    'Chemistry',
    ['Light and matter', 'Greenhouse gases', 'Spectroscopy'],
    'Shine different light on molecules and see how they absorb it.',
  ),

  /* ------------------------------- Biology ------------------------------- */
  phet(
    'natural-selection',
    'Natural Selection',
    'Biology',
    ['Natural selection', 'Evolution', 'Heredity', 'Mutation'],
    'Add mutations and environmental factors and watch a bunny population evolve.',
  ),
  phet(
    'gene-expression-essentials',
    'Gene Expression Essentials',
    'Biology',
    ['Gene expression', 'Protein synthesis', 'Molecular basis of inheritance', 'DNA'],
    'Express genes to make proteins; explore transcription and translation.',
  ),
  phet(
    'neuron',
    'Neuron',
    'Biology',
    ['Nervous system', 'Neural control and coordination', 'Action potential'],
    'Stimulate a neuron and watch the action potential travel along it.',
  ),
  phet(
    'membrane-transport',
    'Membrane Transport',
    'Biology',
    ['Cell membrane', 'Transport across membranes', 'Diffusion and active transport'],
    'Explore how particles cross a cell membrane through channels and transporters.',
  ),

  /* ------------------------------- Mathematics ------------------------------- */
  phet(
    'fractions-intro',
    'Fractions: Intro',
    'Mathematics',
    ['Fractions', 'Numerator and denominator', 'Number line'],
    'Build fractions from shapes and numbers and place them on a number line.',
  ),
  phet(
    'fractions-equality',
    'Fractions: Equality',
    'Mathematics',
    ['Fractions', 'Equivalent fractions'],
    'Make equal fractions with shapes and numbers.',
  ),
  phet(
    'fractions-mixed-numbers',
    'Fractions: Mixed Numbers',
    'Mathematics',
    ['Fractions', 'Mixed numbers', 'Improper fractions'],
    'Build and match mixed numbers and improper fractions.',
  ),
  phet(
    'build-a-fraction',
    'Build a Fraction',
    'Mathematics',
    ['Fractions', 'Equivalent fractions'],
    'Build fractions to match targets using shapes and numbers.',
  ),
  phet(
    'fraction-matcher',
    'Fraction Matcher',
    'Mathematics',
    ['Fractions', 'Equivalent fractions', 'Comparing fractions'],
    'Match shapes and numbers to find equivalent fractions.',
  ),
  phet(
    'arithmetic',
    'Arithmetic',
    'Mathematics',
    ['Multiplication', 'Division', 'Factors'],
    'Practise multiplication, division and factoring with grids.',
  ),
  phet(
    'make-a-ten',
    'Make a Ten',
    'Mathematics',
    ['Addition', 'Place value', 'Number sense'],
    'Add numbers by making tens; explore place value.',
  ),
  phet(
    'number-play',
    'Number Play',
    'Mathematics',
    ['Counting', 'Number sense', 'Place value'],
    'Count, compare and represent numbers up to 20.',
  ),
  phet(
    'number-line-integers',
    'Number Line: Integers',
    'Mathematics',
    ['Integers', 'Number line', 'Negative numbers'],
    'Place and compare integers on a number line.',
  ),
  phet(
    'area-builder',
    'Area Builder',
    'Mathematics',
    ['Area', 'Perimeter', 'Mensuration'],
    'Build shapes with unit squares and explore area and perimeter.',
  ),
  phet(
    'area-model-introduction',
    'Area Model Introduction',
    'Mathematics',
    ['Multiplication', 'Area model', 'Area'],
    'Use rectangles to model multiplication.',
  ),
  phet(
    'area-model-multiplication',
    'Area Model Multiplication',
    'Mathematics',
    ['Multiplication', 'Area model', 'Distributive property'],
    'Multiply larger numbers with partitioned area models.',
  ),
  phet(
    'unit-rates',
    'Unit Rates',
    'Mathematics',
    ['Ratio and proportion', 'Unit rate', 'Unitary method'],
    'Shop and race to explore unit rates and the unitary method.',
  ),
  phet(
    'proportion-playground',
    'Proportion Playground',
    'Mathematics',
    ['Ratio and proportion', 'Equivalent ratios'],
    'Explore ratios with necklaces, paint, billiards and apples.',
  ),
  phet(
    'ratio-and-proportion',
    'Ratio and Proportion',
    'Mathematics',
    ['Ratio and proportion', 'Equivalent ratios'],
    'Move hands to keep a ratio and feel proportional reasoning.',
  ),
  phet(
    'equality-explorer',
    'Equality Explorer',
    'Mathematics',
    ['Linear equations', 'Algebra', 'Balancing equations'],
    'Balance a scale to solve equations in one variable.',
  ),
  phet(
    'expression-exchange',
    'Expression Exchange',
    'Mathematics',
    ['Algebraic expressions', 'Like terms', 'Algebra'],
    'Build and simplify expressions by combining like terms.',
  ),
  phet(
    'function-builder',
    'Function Builder',
    'Mathematics',
    ['Functions', 'Relations and functions', 'Algebra'],
    'Send inputs through function machines and find the rule.',
  ),
  phet(
    'graphing-lines',
    'Graphing Lines',
    'Mathematics',
    ['Straight lines', 'Slope', 'Coordinate geometry', 'Linear equations in two variables'],
    'Graph lines and explore slope and the equations of a line.',
  ),
  phet(
    'graphing-slope-intercept',
    'Graphing Slope-Intercept',
    'Mathematics',
    ['Straight lines', 'Slope-intercept form', 'Coordinate geometry'],
    'Explore y = mx + b by changing slope and intercept.',
  ),
  phet(
    'graphing-quadratics',
    'Graphing Quadratics',
    'Mathematics',
    ['Quadratic equations', 'Polynomials', 'Parabola'],
    'Explore the graph of a quadratic: vertex, roots, axis of symmetry and focus.',
  ),
  phet(
    'trig-tour',
    'Trig Tour',
    'Mathematics',
    ['Trigonometry', 'Trigonometric functions', 'Unit circle'],
    'Move around the unit circle and graph sine, cosine and tangent.',
  ),
  phet(
    'calculus-grapher',
    'Calculus Grapher',
    'Mathematics',
    ['Derivatives', 'Integrals', 'Calculus'],
    'Draw a function and see its derivative and integral.',
  ),
  phet(
    'curve-fitting',
    'Curve Fitting',
    'Mathematics',
    ['Regression', 'Statistics', 'Curve fitting'],
    'Fit linear, quadratic and cubic curves to data points.',
  ),
  phet(
    'least-squares-regression',
    'Least-Squares Regression',
    'Mathematics',
    ['Regression', 'Correlation', 'Statistics'],
    'Find the best-fit line and the correlation coefficient.',
  ),
  phet(
    'center-and-variability',
    'Center and Variability',
    'Mathematics',
    ['Statistics', 'Mean, median and mode', 'Range and spread'],
    'Explore measures of centre and spread with kicked balls.',
  ),
  phet(
    'mean-share-and-balance',
    'Mean: Share and Balance',
    'Mathematics',
    ['Statistics', 'Mean', 'Data handling'],
    'Share and balance to understand the mean.',
  ),
  phet(
    'plinko-probability',
    'Plinko Probability',
    'Mathematics',
    ['Probability', 'Binomial distribution', 'Statistics'],
    'Drop balls through a peg board and see a distribution build up.',
  ),

  /* ------------------------------- Earth science ------------------------------- */
  phet(
    'gravity-and-orbits',
    'Gravity and Orbits',
    'Earth science',
    ['Gravitation', 'Solar system', 'Orbits', 'Moon and satellites'],
    'Move the Sun, Earth, Moon and a satellite and see how gravity shapes orbits.',
  ),
  phet(
    'my-solar-system',
    'My Solar System',
    'Earth science',
    ['Solar system', 'Orbits', 'Gravitation'],
    'Build your own system of bodies and watch them orbit.',
  ),
  phet(
    'keplers-laws',
    "Kepler's Laws",
    'Earth science',
    ["Kepler's laws", 'Orbits', 'Gravitation', 'Planetary motion'],
    'Explore elliptical orbits, equal areas and orbital periods.',
  ),
  phet(
    'greenhouse-effect',
    'The Greenhouse Effect',
    'Earth science',
    ['Greenhouse effect', 'Climate change', 'Atmosphere', 'Global warming'],
    'See how greenhouse gases change the energy balance of the Earth.',
  ),
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** True when every word of the query appears in the simulation's title, subject, topics or description. */
export function matchesQuery(
  sim: Pick<Simulation, 'title' | 'subject' | 'topics' | 'description'>,
  q: string | undefined,
): boolean {
  const words = q ? norm(q).split(' ').filter(Boolean) : [];
  if (!words.length) return true;
  const hay = norm([sim.title, sim.subject, ...sim.topics, sim.description ?? ''].join(' '));
  return words.every((w) => hay.includes(w));
}

export const matchesSubject = (sim: Pick<Simulation, 'subject'>, subject: string | undefined) =>
  !subject || sim.subject.toLowerCase() === subject.trim().toLowerCase();

export function searchCatalog(q?: string, subject?: string): Simulation[] {
  return SIMULATION_CATALOG.filter((s) => matchesSubject(s, subject) && matchesQuery(s, q));
}
