
const Alpine = require('alpinejs').default;

const { booleans, /* colors,*/ primitives, transforms, extrusions } = require('@jscad/modeling')
const { cube, cuboid, line, sphere, star, rectangle, roundedRectangle, circle } = primitives
const { translate } = transforms
const { extrudeLinear } = extrusions
const { intersect, subtract } = booleans
// const { colorize } = colors

const { create_re_render_fn } = require('./jscad_wrapper.js');

// ********************
// The design to render.
// ********************

const info = {
  constants: {
    screw_hole_radius: 3.2/2.0, //mm
    horizontal_pitch_mm: 5.08, //mm
    slidepot_width: 2.0, // mm
    rotarypot_margin: 0.1, // mm // TODO THIS IS UNUSED
    toggleswitch_margin: 0.1, // mm // TODO THIS IS UNUSED
    patchpoint_margin: 0.1, // mm // TODO THIS IS UNUSED
    circle_quality: 20, // how many segments to render circles with
  },

  // vertical pitch options
  // TODO: once i've added the data for vp_options, we may just be able to change screw_height to be calculated (total_height - (3mm*2))  
  vp_options: [ // keyed by model.vp_index
    { display: "1U Doepfer tiles", nominal: 1, height: 128.50, screw_height: 122.5},
    { display: "1U Intellijel tiles", nominal: 1, height: 128.50, screw_height: 122.5},
    { display: "3U Standard Eurorack Size", nominal: 3, height: 128.50, screw_height: 122.5},
    { display: "5U Moog-format", nominal: 5, height: 128.50, screw_height: 122.5},
  ],

  // the kinds of "features" you can add to a panel
  feature_types: { // keyed by model.features[].type
    patch_point: "Patch Point",
    rotarypot: "Rotary Potentiometer",
    slidepot: "Slide Potentiometer",
    toggle_switch: "Toggle Switch",
    led: "LED"
  },

  // horizontal pitch options
  hp_options: [ // keyed by model.hp_index
    {hp: 1   ,  holes: 2, actual: 5.00   },
    {hp: 1.5 ,  holes: 2, actual: 7.50   },
    {hp: 2   ,  holes: 2, actual: 9.80   },
    {hp: 4   ,  holes: 2, actual: 20.00  },
    {hp: 6   ,  holes: 2, actual: 30.00  },
    {hp: 8   ,  holes: 2, actual: 40.30  },
    {hp: 10  ,  holes: 2, actual: 50.50  },
    {hp: 12  ,  holes: 4, actual: 60.60  },
    {hp: 14  ,  holes: 4, actual: 70.80  },
    {hp: 16  ,  holes: 4, actual: 80.90  },
    {hp: 18  ,  holes: 4, actual: 91.30  },
    {hp: 20  ,  holes: 4, actual: 101.30 },
    {hp: 21  ,  holes: 4, actual: 106.30 },
    {hp: 22  ,  holes: 4, actual: 111.40 },
    {hp: 24  ,  holes: 4, actual: 121.60 },
    {hp: 28  ,  holes: 4, actual: 141.90 },
    {hp: 42  ,  holes: 4, actual: 213.00 }
  ],

  // the chosen hole placement - this CLOUD be restricted by your choice of HP (hp_options incudes a holes property)
  hole_positions: [ // keyed by model.holes_index
    { screw_positions: ["tl", "br"], display: "Top left + Bottom right" },
    { screw_positions: ["tr", "bl"], display: "Top right + Bottom reft"},
    { screw_positions: ["tr", "br"], display: "Top right + Bottom right" },
    { screw_positions: ["tl", "bl"], display: "Top left + Bottom left"},
    { screw_positions: ["tl", "tr", "bl", "br"], display: "Two top + two bottom"}
  ],

  // Size choices, arranged by feature
  feature_size_options: {
    patch_point: [
      { display:  "3.5mm / 1/8\"", size: 3.5   },
      { display: "6.35mm / 1/4\"", size: 6.35 }
    ],
    rotarypot: [
      { display:  "6mm shaft", size: 6.0   },
      { display:  "6.3mm shaft", size: 6.3 }
    ],
    slidepot: [
      { display:  "20mm travel", size: 20   },
      { display:  "25mm travel", size: 25   },
      { display:  "30mm travel", size: 30   },
      { display:  "35mm travel", size: 35   },
      { display:  "40mm travel", size: 40   },
      { display:  "45mm travel", size: 45   },
    ],
    toggle_switch: [
      { display:  "TS",   size: 8.0  },
      { display:  "MTS",  size: 6.0  },
      { display:  "SMTS", size: 6.3  } // sice SIZE is the key, these need to be unique
    ],
    led: [
      { display:  "Standard Xmm", size: 4  },
      { display:  "Weird small",  size: 2  },
      { display:  "Weird big",    size: 6  }
    ]
  },

  // these are potential positioning frames of reference.
  frames_of_reference: { // keyed by model.feature[].position.relative_to
    center      : { display: "Center",              fn: (pos, width, height) => [pos.x, pos.y, 0]                  },
    topcenter   : { display: "Top side, center",    fn: (pos, width, height) => [pos.x, pos.y+height/2, 0]         },
    bottomcenter: { display: "Bottom side, center", fn: (pos, width, height) => [pos.x, pos.y-height/2, 0]         },
    leftcenter  : { display: "Left side, center",   fn: (pos, width, height) => [pos.x-width/2, pos.y, 0]          },
    rightcenter : { display: "Right side, center",  fn: (pos, width, height) => [pos.x+width/2, pos.y, 0]          },
    topleft     : { display: "Top left corner",     fn: (pos, width, height) => [pos.x-width/2, pos.y+height/2, 0] },
    topright    : { display: "Top right corner",    fn: (pos, width, height) => [pos.x+width/2, pos.y+height/2, 0] },
    bottomleft  : { display: "Bottom left corner",  fn: (pos, width, height) => [pos.x-width/2, pos.y-height/2, 0] },
    bottomright : { display: "Bottom right corner", fn: (pos, width, height) => [pos.x+width/2, pos.y-height/2, 0] },
  },


}

// this function draws features that will be subtracted from the main panel
const renderFeature = (feature, width, height) => {
  if (feature.type == "slidepot") {
    return translate(
      info.frames_of_reference[feature.position.relative_to].fn(feature.position, width, height),
      roundedRectangle({ size: [info.constants.slidepot_width, feature.size], roundRadius: info.constants.slidepot_width/2-0.01 })
    )
  } else {
    return translate(
      info.frames_of_reference[feature.position.relative_to].fn(feature.position, width, height),
      circle({ radius: feature.size/2.0, segments: info.constants.circle_quality})
    )
  }
  return undefined;
}

// this is my main modelling function, the model is created here.
const create_entities = (model) => {
  const hp_looked_up = info.hp_options[model.hp_index];
  const holes = info.hole_positions[model.holes_index];
  const actual_width = hp_looked_up.actual;
  const vertical_data = info.vp_options[model.vp_index];
  const panel_height = vertical_data.height;
  const screw_height = vertical_data.screw_height;

  const panel_points = [
    [-actual_width/2, -panel_height/2 ],  // top left
    [actual_width/2 ,  -panel_height/2],  // top right
    [actual_width/2 ,  panel_height/2 ],  // bottom right
    [-actual_width/2, panel_height/2  ],  // bottom left
  ];

  const panel_outline = rectangle({ size: [actual_width, panel_height] });

  const screw_hole_distance = Math.max(0, hp_looked_up.hp - 3) * info.constants.horizontal_pitch_mm;

  const screw_holes_dict = {
    tl: translate([-screw_hole_distance/2, +screw_height/2, 0], circle({ radius: info.constants.screw_hole_radius, segments: info.constants.circle_quality})),
    tr: translate([+screw_hole_distance/2, +screw_height/2, 0], circle({ radius: info.constants.screw_hole_radius, segments: info.constants.circle_quality})),
    bl: translate([-screw_hole_distance/2, -screw_height/2, 0], circle({ radius: info.constants.screw_hole_radius, segments: info.constants.circle_quality})),
    br: translate([+screw_hole_distance/2, -screw_height/2, 0], circle({ radius: info.constants.screw_hole_radius, segments: info.constants.circle_quality})),
  };
  
  const screw_holes = holes.screw_positions.map(function(location){ return screw_holes_dict[location] });

  let subtract_features = [];
  let non_subtract_features = [];

  model.features.forEach((feature)=>{
    const pos = info.frames_of_reference[feature.position.relative_to].fn(feature.position, actual_width, panel_height);
    const abs_x = Math.abs(pos[0]);
    const abs_y = Math.abs(pos[1]);

    if (abs_x <= actual_width/2 && abs_y <= panel_height/2) {
      subtract_features.push(feature);
    } else {
      non_subtract_features.push(feature);
    }
  });

  const rendered_subtract_features = subtract_features.map(function(feature) {
    return renderFeature(feature, actual_width, panel_height)
  });

  const rendered_non_subtract_features = non_subtract_features.map(function(feature) {
    return renderFeature(feature, actual_width, panel_height)
  });

  const panel = subtract(panel_outline, screw_holes, ...rendered_subtract_features);

  const body = extrudeLinear({height: 1.6}, panel); // this is where we make it 3D

  return [body, ...rendered_non_subtract_features];
}

// listen for alpine init, load a default model into the store
// trigger an initial render
document.addEventListener('alpine:init', () => {
  Alpine.store('panel', {
    vp_index: 2, // how many U it is.
    hp_index: 3,
    holes_index: 0,
    features: [],

    addFeature(feature_type) {
      this.features.push({
        type: feature_type,
        size: info.feature_size_options[feature_type][0].size,
        position: {
          x: 0,
          y: 0,
          relative_to: "center"
        }
      });
      re_render(this);
    },

    deleteFeature(index) {
      this.features.splice(index, 1);
      re_render(this);
    },

    saveData() {
      let output = {};
      output.vp = info.vp_options[this.vp_index].nominal;
      output.hp = info.hp_options[this.hp_index].hp;
      output.hole_positions = info.hole_positions[this.holes_index].screw_positions;
      output.features = this.features.map(function(feature){
        return {
          type: feature.type,
          size: feature.size,
          position: {
            x: feature.position.x,
            y: feature.position.y,
            relative_to: feature.position.relative_to
          }
        }
      });

      alert(JSON.stringify(output));
    },

    // replace the current data with data from the import
    loadData(importString) {
      const importData = JSON.parse(importString);
      this.vp_index = info.vp_options.findIndex((opt)=>{return opt.nominal == importData.vp});
      this.hp_index = lookupHp(importData.hp) || this.hp_index;
      this.holes_index = lookupHoles(importData.holes) || this.holes_index;
      this.features = importData.features.map(function(importFeature){
        if (!importFeature.type) {
          return undefined; // no type, no feature.
        }

        return {
          type: importFeature.type,
          size: importFeature.size || info.feature_size_options[importFeature.type][0].size || 5,
          position: {
            x: importFeature.position.x || 0,
            y: importFeature.position.y || 0,
            relative_to: importFeature.position.relative_to || "center",
          }
        }
      }).filter(anyValue => typeof anyValue !== 'undefined' ) || [];
    }
  });

  re_render(Alpine.store('panel'));
})

const re_render = create_re_render_fn(create_entities);

window.re_render = re_render; // make re_render available to alpine scripts in html
window.info = info; // make info available to alpine scripts in html

Alpine.start();