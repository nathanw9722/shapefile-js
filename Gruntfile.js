module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		requirejs:{
        all:{options:{
          out: "./dist/shp.js",
          baseUrl: "./src",
          //name: "proj4",
          wrap: {
            startFile: 'almond/top.frag',
            endFile: 'almond/end.frag'
          },
          name: '../node_modules/almond/almond',
          include: ['shp'],
          optimize:'none',
          //uglify2:{
          //  mangle: true
          //},
          preserveLicenseComments: false
        }
      }
      }
      });
	grunt.loadNpmTasks('grunt-contrib-requirejs');
	grunt.registerTask('default', ['requirejs']);
}
