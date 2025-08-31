<?php
load_theme_textdomain('rectusminimum', get_template_directory() . '/languages');

add_theme_support('title-tag');
add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption'));
add_theme_support('automatic-feed-links');
add_theme_support('post-thumbnails' );
add_theme_support('responsive-embeds');
add_theme_support('custom-logo');
add_theme_support('align-wide');
add_theme_support('custom-background');
add_theme_support('custom-header');

add_filter('run_wptexturize', '__return_false');

function rectusminimum_wp_enqueue_scripts() {
	wp_enqueue_style('style', get_template_directory_uri() . '/style.css');
	wp_enqueue_style('nav', get_template_directory_uri() . '/nav.css');
}
add_action('wp_enqueue_scripts', 'rectusminimum_wp_enqueue_scripts');

add_filter('emoji_svg_url', '__return_false');
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_print_styles', 'print_emoji_styles');

// menu
function rectusminimum_after_setup_theme() {
	add_theme_support('wp-block-styles');
	add_theme_support('editor-styles');
	add_editor_style('editor-style.css');
	register_nav_menu('main-menu', __('Primary Menu', 'rectusminimum'));
};
add_action('after_setup_theme', 'rectusminimum_after_setup_theme');
$rectusminimum_inSubMenuCnt = 0;
class rectusminimum_walker_nav_menu extends Walker_Nav_Menu {
	function start_lvl(&$output, $depth = 0, $args = null) {
		global $rectusminimum_inSubMenuCnt;
		$output .= '<input class="opensubmenu" type="checkbox" id="menu-parent' . strval($rectusminimum_inSubMenuCnt) . '"><label for="menu-parent' . strval($rectusminimum_inSubMenuCnt) . '"><span class="pd"><span class="fas angletoggle"></span></span></label><ul>';
		$rectusminimum_inSubMenuCnt++;
	}
	function end_lvl(&$output, $depth = 0, $args = null) {
		$output .= '</ul>';
	}
	public function start_el( &$output, $data_object, $depth = 0, $args = null, $current_object_id = 0 ) {
		// Restores the more descriptive, specific name for use within this method.
		$menu_item = $data_object;
		$args = (object) $args;
		if ( isset( $args->item_spacing ) && 'discard' === $args->item_spacing ) {
			$t = '';
			$n = '';
		} else {
			$t = "\t";
			$n = "\n";
		}
		$indent = ( $depth ) ? str_repeat( $t, $depth ) : '';

		$classes	 = empty( $menu_item->classes ) ? array() : (array) $menu_item->classes;
		$classes[] = 'menu-item-' . $menu_item->ID;

		$args = apply_filters( 'nav_menu_item_args', $args, $menu_item, $depth );

		$class_names = implode( ' ', apply_filters( 'nav_menu_css_class', array_filter( $classes ), $menu_item, $args, $depth ) );
		$class_names = $class_names ? ' class="' . esc_attr( $class_names ) . '"' : '';

		$id = apply_filters( 'nav_menu_item_id', 'menu-item-' . $menu_item->ID, $menu_item, $args, $depth );
		$id = $id ? ' id="' . esc_attr( $id ) . '"' : '';

		$output .= $indent . '<li' . $id . $class_names . '>';

		$atts 					= array();
		$atts['title']	= ! empty( $menu_item->attr_title ) ? $menu_item->attr_title : '';
		$atts['target'] = ! empty( $menu_item->target ) ? $menu_item->target : '';
		if ( '_blank' === $menu_item->target && empty( $menu_item->xfn ) ) {
			$atts['rel'] = 'noopener';
		} else {
			$atts['rel'] = $menu_item->xfn;
		}
		$atts['href'] 				= ! empty( $menu_item->url ) ? $menu_item->url : '';
		$atts['aria-current'] = $menu_item->current ? 'page' : '';

		$atts = apply_filters( 'nav_menu_link_attributes', $atts, $menu_item, $args, $depth );

		$attributes = '';
		foreach ( $atts as $attr => $value ) {
			if ( is_scalar( $value ) && '' !== $value && false !== $value ) {
				$value			 = ( 'href' === $attr ) ? esc_url( $value ) : esc_attr( $value );
				$attributes .= ' ' . $attr . '="' . $value . '"';
			}
		}

		/** This filter is documented in wp-includes/post-template.php */
		$title = apply_filters( 'the_title', $menu_item->title, $menu_item->ID );

		$title = apply_filters( 'nav_menu_item_title', $title, $menu_item, $args, $depth );

		$item_output	= $args->before;
		$item_output .= '<a' . $attributes . '>';
		$item_output .= $args->link_before . $title . $args->link_after;
		$item_output .= '</a>';
		$item_output .= $args->after;

		$output .= apply_filters( 'walker_nav_menu_start_el', $item_output, $menu_item, $depth, $args );
	}
}
// remove id
function rectusminimum_nav_menu_item_id( $id ){ 
	return $id = array(); 
}
add_filter('nav_menu_item_id', 'rectusminimum_nav_menu_item_id', 10);

// add and remove class li
function rectusminimum_nav_menu_css_class($classes, $item, $args, $depth) {
	if(!empty($classes[0])) {
		$classes = array(esc_attr($classes[0]));
	} else {
		$classes = array();
	}
	if($item->current == true ) {
				$classes[] = 'current';
	}
	return $classes;
}
add_filter('nav_menu_css_class', 'rectusminimum_nav_menu_css_class', 10, 4);

// Last-Modified head
function rectusminimum_template_redirect(){
	if (is_single()) {
		header(sprintf("Last-Modified: %s", gmdate('D, d M Y H:i:s T', strtotime(get_the_modified_time("c")))));
	}
}
add_action("template_redirect", "rectusminimum_template_redirect");

function rectusminimum_comment_form_before() {
	if(get_option('thread_comments')) {
		wp_enqueue_script('comment-reply');
	}
}
add_action('comment_form_before', 'rectusminimum_comment_form_before');

/* front page back ground image */
function rectusminimum_widgets_init() {
	register_sidebar(array(
		'name'=>'footer bar',
		'id' => 'side-widget',
		'before_widget'=>'
		<div id="%1$s" class="%2$s sidebar-wrapper">',
		'after_widget'=>'</div>',
		'before_title' => '<h5 class="sidebar-title">',
		'after_title' => '</h5>'
	));
}
add_action('widgets_init', 'rectusminimum_widgets_init');

function rectusminimum_admin_print_scripts() {
	wp_enqueue_media();
}
add_action('admin_print_scripts', 'rectusminimum_admin_print_scripts');

function rectusminimum_admin_init() {
	register_setting('custom-menu-group', 'rectusminimum-backimage');
}
function rectusminimum_admin_menu() {
	add_theme_page('frontpage', 'FrontPage', 'manage_options', 'custom_menu_page', 'rectusminimum_add_custom_menu_page');
	add_action('admin_init', 'rectusminimum_admin_init');
}
add_action('admin_menu', 'rectusminimum_admin_menu');

function rectusminimum_add_custom_menu_page() {
?>
<div class="wrap">
	<h2><?php esc_html_e('FrontPage Setting','rectusminimum'); ?></h2>
	<form method="post" action="options.php" enctype="multipart/form-data" encoding="multipart/form-data">
<?php
		settings_fields('custom-menu-group');
		do_settings_sections('custom-menu-group');
?>
		<div class="metabox-holder">
			<div class="postbox ">
				<h3 class='hndle'><span><?php esc_html_e('Back Ground Image','rectusminimum'); ?></span></h3>
				<div class="inside">
					<div class="main">
						<p class="setting_description"><?php esc_html_e('Upload FrontPage BackImage.','rectusminimum'); ?></p>
						<h4>Image</h4>
						<div class="backuploader">
							<input type="text" class="backuploader-url widefat" name="rectusminimum-backimage" value="<?php echo esc_attr(get_option('rectusminimum-backimage')); ?>">
							<p>
								<button class="backuploader-select button"><?php esc_html_e('Select from media library','rectusminimum'); ?></button>
								<button class="backuploader-clear button"><?php esc_html_e('Clear','rectusminimum'); ?></button>
							</p>
							<p><img class="backuploader-image" src="<?php echo esc_attr(get_option('rectusminimum-backimage')); ?>" style="width: 400px; height: auto;"></p>
						</div>
					</div>
				</div>
			</div>
		</div>
	<?php submit_button(); ?>
	</form>
</div>
<script>
let $uploader = document.getElementsByClassName('backuploader')
Array.from($uploader).forEach((item) => {
	const $url = item.querySelector('.backuploader-url')
	const $image = item.querySelector('.backuploader-image')
	const $select = item.querySelector('.backuploader-select')
	const $clear = item.querySelector('.backuploader-clear')
	let uploader
	$select.addEventListener('click', (e) => {
		e.preventDefault()
		if (uploader) {
			uploader.open()
			return
		}
		uploader = wp.media({
			title: 'Select or Upload the media',
			library: {
				type: 'image'
			},
			button: {
				text: 'select'
			},
			multiple: false
		})
		uploader.on('select', () => {
			const images = uploader.state().get('selection')
			images.forEach( (data) => {
				const url = data.attributes.url
				$url.value = url
				$image.setAttribute('src', url)
			})
		})
		uploader.open()
	})
	$clear.addEventListener('click', (e) => {
		e.preventDefault()
		$url.value = ''
		$image.setAttribute('src', '')
	})
})
</script>
<?php
}


/** 2023.08.11
 * 不要なコードを削除
 */
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('wp_head', 'rest_output_link_wp_head');
remove_action('wp_head', 'wp_oembed_add_discovery_links');
remove_action('wp_head', 'wp_oembed_add_host_js');
remove_action('wp_head', 'feed_links', 2);
remove_action('wp_head', 'feed_links_extra', 3);
remove_action('wp_head', 'wp_generator');



/** 2023.08.11
 * パーマリンクにスペースがある場合スペースをハイフンからアンダースコアに置き換え
 */
function customize_permalink_structure($title) {
		return str_replace('-', '_', $title);
}
add_filter('sanitize_title_with_dashes', 'customize_permalink_structure');



/** 2023.08.11
 * ファイル名にスペースがある場合スペースをハイフンからアンダースコアに置き換え
 */

function customize_file_name($filename) {
		$info = pathinfo($filename);
		$ext	= empty($info['extension']) ? '' : '.' . $info['extension'];
		$name = basename($filename, $ext);

		// スペースをアンダースコアに置き換える
		$name = str_replace(' ', '_', $name);

		return $name . $ext;
}
add_filter('sanitize_file_name', 'customize_file_name', 10);


/** 2023.08.11
 * カテゴリー（アーチスト）に The を付記
 */
// カスタムフィールドの追加
function add_the_prefix_field($taxonomy) {
		?>
		<div class="form-field term-group">
				<label for="the-prefix-checkbox"><?php _e('Include "The" Prefix', 'your-textdomain'); ?></label>
				<input type="checkbox" id="the-prefix-checkbox" name="the_prefix" value="1">
		</div>
		<?php
}
add_action('category_add_form_fields', 'add_the_prefix_field', 10, 1);

// カスタムフィールドの保存
function save_the_prefix_field($term_id) {
		if (isset($_POST['the_prefix']) && '1' === $_POST['the_prefix']) {
				add_term_meta($term_id, 'the_prefix', '1', true);
		}
}
add_action('created_category', 'save_the_prefix_field', 10, 1);

// カテゴリー編集画面にカスタムフィールドを追加
function edit_the_prefix_field($term) {
		$the_prefix = get_term_meta($term->term_id, 'the_prefix', true);
		?>
		<tr class="form-field term-group-wrap">
				<th scope="row"><label for="the-prefix-checkbox"><?php _e('Include "The" Prefix', 'your-textdomain'); ?></label></th>
				<td><input type="checkbox" id="the-prefix-checkbox" name="the_prefix" value="1" <?php checked($the_prefix, '1'); ?>></td>
		</tr>
		<?php
}
add_action('category_edit_form_fields', 'edit_the_prefix_field', 10, 1);

// カテゴリー編集画面でカスタムフィールドの値を保存
function update_the_prefix_field($term_id) {
		if (isset($_POST['the_prefix'])) {
				update_term_meta($term_id, 'the_prefix', '1');
		} else {
				delete_term_meta($term_id, 'the_prefix');
		}
}
add_action('edited_category', 'update_the_prefix_field', 10, 1);

// カテゴリー名の表示関数
function display_artist_name_with_the_prefix($category_id) {
		// カスタムフィールド 'the_prefix' の値を取得
		$the_prefix = get_term_meta($category_id, 'the_prefix', true);

		// カテゴリー名を取得
		$category = get_category($category_id);
		$name = $category->name;

		// 'the_prefix' が設定されている場合、先頭に "The" を追加
		if ($the_prefix) {
				$name = "The " . $name;
		}

		return $name;
}


/** 2023.08.11
 * カスタムタクソノミー ジャンル
 */
function create_genre_taxonomy() {
	$labels = array(
		'name' => _x( 'Genres', 'taxonomy general name' ),
		'singular_name' => _x( 'Genre', 'taxonomy singular name' ),
		'search_items' =>  __( 'Search Genres' ),
		'all_items' => __( 'All Genres' ),
		'parent_item' => __( 'Parent Genre' ),
		'parent_item_colon' => __( 'Parent Genre:' ),
		'edit_item' => __( 'Edit Genre' ),
		'update_item' => __( 'Update Genre' ),
		'add_new_item' => __( 'Add New Genre' ),
		'new_item_name' => __( 'New Genre Name' ),
		'menu_name' => __( 'Genres' ),
	);

	register_taxonomy(
		'genre', 
		array('post'), // このタクソノミーを適用する投稿タイプ。例：'post', 'page' など。
		array(
			'hierarchical' => true,
			'labels' => $labels,
			'show_ui' => true,
			'show_admin_column' => true,
			'show_in_rest' => true, // 追加
			'query_var' => true,
			'rewrite' => array( 'slug' => 'genre' ),
		)
	);
}
add_action( 'init', 'create_genre_taxonomy', 0 );


/** 2023.08.11
 * ポップアップウィンドウ（カスタムタクソノミー ジャンル）
 */


function enqueue_youtube_to_wp_script() {
		wp_enqueue_script('youtube-to-wp', get_template_directory_uri() . '/youtube-to-wp.js', array(), null, true);
}

add_action('admin_enqueue_scripts', 'enqueue_youtube_to_wp_script');


/** 2023.08.12
 * Font AwesomeをWordPressで使用
 */

function theme_enqueue_styles() {
		wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css');
}
add_action('wp_enqueue_scripts', 'theme_enqueue_styles');


/** 2023.08.12
 * カスタムタクソノミー ボーカル
 */
function create_vocal_taxonomy() {
	$labels = array(
		'name' => _x( 'vocals', 'taxonomy general name' ),
		'singular_name' => _x( 'vocal', 'taxonomy singular name' ),
		'search_items' =>  __( 'Search vocals' ),
		'all_items' => __( 'All vocals' ),
		'parent_item' => __( 'Parent vocal' ),
		'parent_item_colon' => __( 'Parent vocal:' ),
		'edit_item' => __( 'Edit vocal' ),
		'update_item' => __( 'Update vocal' ),
		'add_new_item' => __( 'Add New vocal' ),
		'new_item_name' => __( 'New vocal Name' ),
		'menu_name' => __( 'vocals' ),
	);

	register_taxonomy(
		'vocal', 
		array('post'), // このタクソノミーを適用する投稿タイプ。例：'post', 'page' など。
		array(
			'hierarchical' => true,
			'labels' => $labels,
			'show_ui' => true,
			'show_admin_column' => true,
			'show_in_rest' => true, // 追加
			'query_var' => true,
			'rewrite' => array( 'slug' => 'vocal' ),
		)
	);
}
add_action( 'init', 'create_vocal_taxonomy', 0 );


// タクソノミーの保存処理を強化して、「よく使うもの」タブから選択された値も正しく保存 20241116
add_action('save_post', function($post_id) {
		// 自動保存や権限確認をスキップ
		if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
				return;
		}
		if (!current_user_can('edit_post', $post_id)) {
				return;
		}

		// タクソノミー: Vocal
		if (isset($_POST['tax_input']['vocal']) && is_array($_POST['tax_input']['vocal'])) {
				$vocal_terms = array_map('intval', $_POST['tax_input']['vocal']); // タームIDを整数化
				wp_set_post_terms($post_id, $vocal_terms, 'vocal');
		}

		// タクソノミー: Genre
		if (isset($_POST['tax_input']['genre']) && is_array($_POST['tax_input']['genre'])) {
				$genre_terms = array_map('intval', $_POST['tax_input']['genre']); // タームIDを整数化
				wp_set_post_terms($post_id, $genre_terms, 'genre');
		}
});



/** 2023.08.12
 * カスタムタクソノミー スタイル
 */
function create_style_taxonomy() {
	$labels = array(
		'name' => _x( 'styles', 'taxonomy general name' ),
		'singular_name' => _x( 'style', 'taxonomy singular name' ),
		'search_items' =>  __( 'Search styles' ),
		'all_items' => __( 'All styles' ),
		'parent_item' => __( 'Parent style' ),
		'parent_item_colon' => __( 'Parent style:' ),
		'edit_item' => __( 'Edit style' ),
		'update_item' => __( 'Update style' ),
		'add_new_item' => __( 'Add New style' ),
		'new_item_name' => __( 'New style Name' ),
		'menu_name' => __( 'styles' ),
	);

	register_taxonomy(
		'style', 
		array('post'), // このタクソノミーを適用する投稿タイプ。例：'post', 'page' など。
		array(
			'hierarchical' => true,
			'labels' => $labels,
			'show_ui' => true,
			'show_admin_column' => true,
			'show_in_rest' => true, // 追加
			'query_var' => true,
			'rewrite' => array( 'slug' => 'style' ),
		)
	);
}
add_action( 'init', 'create_style_taxonomy', 0 );


/** 2025.03.19
 * カスタムタクソノミー スタイル
 */
function create_soundtrack_taxonomy() {
		$labels = array(
				'name'							=> _x( 'Soundtracks', 'taxonomy general name', 'textdomain' ),
				'singular_name' 		=> _x( 'Soundtrack', 'taxonomy singular name', 'textdomain' ),
				'search_items'			=> __( 'Soundtrackを検索', 'textdomain' ),
				'all_items' 				=> __( '全てのSoundtrack', 'textdomain' ),
				'parent_item' 			=> __( '親Soundtrack', 'textdomain' ),
				'parent_item_colon' => __( '親Soundtrack:', 'textdomain' ),
				'edit_item' 				=> __( 'Soundtrackの編集', 'textdomain' ),
				'update_item' 			=> __( 'Soundtrackの更新', 'textdomain' ),
				'add_new_item'			=> __( '新しいSoundtrackを追加', 'textdomain' ),
				'new_item_name' 		=> __( '新しいSoundtrack名', 'textdomain' ),
				'menu_name' 				=> __( 'Soundtrack', 'textdomain' ),
		);

		$args = array(
				'hierarchical'			=> true, // trueの場合はカテゴリータイプ、falseの場合はタグタイプ
				'labels'						=> $labels,
				'show_ui' 					=> true,
				'show_admin_column' => true,
				'query_var' 				=> true,
				'rewrite' 					=> array( 'slug' => 'soundtrack' ),
		);

		register_taxonomy( 'soundtrack', array( 'post' ), $args );
}
add_action( 'init', 'create_soundtrack_taxonomy', 0 );




/** 2023.08.14
 * spotify-to-wp
 */
function enqueue_spotify_to_wp_script() {
		wp_enqueue_script('spotify-to-wp', plugin_dir_url(__FILE__) . 'spotify-to-wp.js', array('jquery'), null, true);
		wp_localize_script('spotify-to-wp', 'spotifyApiSettings', array(
				'ajax_url' => admin_url('admin-ajax.php'),
		));
}
add_action('admin_enqueue_scripts', 'enqueue_spotify_to_wp_script');

function add_spotify_button_metabox() {
		add_meta_box('spotify-button-metabox', 'Spotify', 'render_spotify_button', 'post');
}
add_action('add_meta_boxes', 'add_spotify_button_metabox');

function render_spotify_button() {
		echo '<button id="spotify-button" type="button">Spotify Button</button>';
}




// VIDEO CSSファイルのエンキュー
function enqueue_custom_style() {
	wp_enqueue_style('custom-style', get_stylesheet_directory_uri() . '/video.css', array(), '1.0.0');
}

add_action('wp_enqueue_scripts', 'enqueue_custom_style');


// ページネーション
function custom_query_vars_filter($vars) {
		$vars[] = 'paged';
		return $vars;
}
add_filter('query_vars', 'custom_query_vars_filter');




// 2023.09.11 GENRE入力補助
// メタボックスを追加
function add_genre_metabox() {
		add_meta_box(
				'select-genre-metabox',
				'ジャンルを選択',
				'display_genre_metabox',
				'post', // postタイプに追加する場合
				'side',
				'default'
		);
}
add_action('add_meta_boxes', 'add_genre_metabox');

// メタボックスのコンテンツを表示
function display_genre_metabox() {
		echo '<button type="button" id="select-genre-btn" class="button">ジャンルを選択</button>';
}


function get_most_common_genre_by_artist($artist_id) {
		$posts = get_posts(array(
				'category' => $artist_id,
				'posts_per_page' => -1,
		));

		$genre_count = array();

		foreach ($posts as $post) {
				$genres = wp_get_post_terms($post->ID, 'genre');
				foreach ($genres as $genre) {
						if (isset($genre_count[$genre->term_id])) {
								$genre_count[$genre->term_id]++;
						} else {
								$genre_count[$genre->term_id] = 1;
						}
				}
		}

		arsort($genre_count);
		$most_common_genre_id = key($genre_count);
		return get_term($most_common_genre_id, 'genre');
}


function add_genre_popup() {
		global $post;
		if (!is_object($post) || !isset($post->ID)) {
				// $post が適切なオブジェクトでない場合の処理
				return; // またはエラーメッセージを表示
		}

		$categories = get_the_category($post->ID);

		echo '<div id="genre-popup" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background-color:white; padding:20px; box-shadow:0 0 10px rgba(0,0,0,0.3); max-height:80vh; overflow-y:scroll;">';

		echo '<button id="close-genre-popup-top" style="margin-bottom: 20px;">閉じる</button>'; // 上部の閉じるボタン

		$associated_genres = array();
		if (!empty($categories)) {
				echo '<h2>アーチスト: ' . esc_html($categories[0]->name) . '</h2>';

				$related_posts = get_posts(array(
						'category' => $categories[0]->term_id,
						'posts_per_page' => -1
				));

				foreach ($related_posts as $related_post) {
						$post_genres = wp_get_post_terms($related_post->ID, 'genre');
						foreach ($post_genres as $post_genre) {
								$associated_genres[$post_genre->term_id] = $post_genre->name;
						}
				}
		}

		// 関連ジャンルのみを表示
		foreach ($associated_genres as $term_id => $genre_name) {
				echo '<div><label><input type="checkbox" value="' . $term_id . '">' . esc_html($genre_name) . '</label></div>';
		}

		echo '<hr>'; // 関連ジャンルと他のジャンルを区切る線

		$genres = get_terms(array(
				'taxonomy' => 'genre',
				'hide_empty' => false,
				'orderby' => 'name',
				'order' => 'ASC'
		));

		$current_initial = ''; // 現在の頭文字をトラックするための変数

		foreach ($genres as $genre) {
				$genre_initial = mb_substr($genre->name, 0, 1); // ジャンル名の最初の文字を取得

				if ($genre_initial !== $current_initial) {
						if ($current_initial !== '') {
								echo '</div>'; // 前のフレックスコンテナを閉じる
						}
						echo '<h3>' . $genre_initial . '</h3>'; // 頭文字を表示
						echo '<div style="display: flex; flex-wrap: wrap; gap: 10px;">'; // 新しいフレックスコンテナを開始
						$current_initial = $genre_initial;
				}

				echo '<div style="width: calc(33.333% - 10px);"><label><input type="checkbox" value="' . $genre->term_id . '">' . $genre->name . '</label></div>'; // 各ジャンル項目に幅を設定
		}

		if ($current_initial !== '') {
				echo '</div>'; // 最後のフレックスコンテナを閉じる
		}

		echo '<button id="close-genre-popup-bottom" style="margin-top: 20px;">閉じる</button>'; // 下部の閉じるボタン
		echo '</div>';
}
add_action('admin_footer', 'add_genre_popup');


function enqueue_admin_scripts_v2() {
		echo "
		<script>
				jQuery(document).ready(function($) {
						$('#select-genre-btn').click(function() {
								$('#genre-popup').show();
						});
						$('#close-genre-popup-top, #close-genre-popup-bottom').click(function() {
								$('#genre-popup').hide();

								// 選択されたジャンルのIDを収集
								var selected_genres = [];
								$('#genre-popup input[type=\"checkbox\"]:checked').each(function() {
										selected_genres.push($(this).val());
								});

								// 既存のジャンル選択BOXに選択を反映
								$('#genrediv input[type=\"checkbox\"]').each(function() {
										var termId = $(this).attr('id').split('-')[2]; // チェックボックスのIDからジャンルのIDを抽出
										if (selected_genres.includes(termId)) {
												$(this).prop('checked', true);
										} else {
												$(this).prop('checked', false);
										}
								});
						});
				});
		</script>";
}
add_action('admin_head', 'enqueue_admin_scripts_v2');




// 管理画面にスクリプトを追加
function enqueue_admin_scripts() {
		echo "
		<script>
				jQuery(document).ready(function($) {
						$('#select-genre-btn').click(function() {
								$('#genre-popup').show();
						});
						$('#close-genre-popup').click(function() {
								$('#genre-popup').hide();

								// 選択されたジャンルのIDを収集
								var selected_genres = [];
								$('#genre-popup input[type=\"checkbox\"]:checked').each(function() {
										selected_genres.push($(this).val());
								});

								// 既存のジャンル選択BOXに選択を反映
								$('#genrediv input[type=\"checkbox\"]').each(function() {
										var termId = $(this).attr('id').split('-')[2]; // チェックボックスのIDからジャンルのIDを抽出
										if (selected_genres.includes(termId)) {
												$(this).prop('checked', true);
										} else {
												$(this).prop('checked', false);
										}
								});
						});
				});
		</script>";
}
add_action('admin_head', 'enqueue_admin_scripts');










// 2023.09.11 カテゴリー入力補助
// メタボックスを追加
function add_category_metabox() {
		add_meta_box(
				'select-category-metabox',
				'カテゴリを選択',
				'display_category_metabox',
				'post',
				'side',
				'default'
		);
}
add_action('add_meta_boxes', 'add_category_metabox');

// メタボックスのコンテンツを表示
function display_category_metabox() {
		echo '<button type="button" id="select-category-btn" class="button">カテゴリを選択</button>';
}

// ポップアップウィンドウのHTMLを追加
function add_category_popup() {
		$categories = get_terms(array(
				'taxonomy' => 'category',
				'hide_empty' => false,
		));

		// カテゴリをアルファベット順にグループ化
		$grouped_categories = [];
		foreach ($categories as $category) {
				$first_letter = mb_substr($category->name, 0, 1);
				$grouped_categories[$first_letter][] = $category;
		}

		echo '<div id="category-popup" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background-color:white; padding:20px; box-shadow:0 0 10px rgba(0,0,0,0.3); max-height:80vh; overflow-y:scroll;">';

		// タブを表示
		echo '<div class="category-tabs">';
		foreach ($grouped_categories as $letter => $categories) {
				echo '<button class="tab-button" data-tab="' . $letter . '">' . $letter . '</button>';
		}
		echo '</div>';

		// カテゴリをタブごとに表示
		foreach ($grouped_categories as $letter => $categories) {
				echo '<div class="tab-content" data-tab="' . $letter . '">';
				foreach ($categories as $category) {
						echo '<div><label><input type="checkbox" value="' . $category->term_id . '">' . $category->name . '</label></div>';
				}
				echo '</div>';
		}

		echo '<button id="close-category-popup">閉じる</button>';
		echo '</div>';
}
add_action('admin_footer', 'add_category_popup');

// 管理画面にスクリプトを追加
function enqueue_category_admin_scripts() {
		echo "

		<script>
				jQuery(document).ready(function($) {
						$('#select-category-btn').click(function() {
								$('#category-popup').show();
						});
						$('#close-category-popup').click(function() {
								$('#category-popup').hide();

								// 選択されたカテゴリのIDを収集
								var selected_categories = [];
								$('#category-popup input[type=\"checkbox\"]:checked').each(function() {
										selected_categories.push($(this).val());
								});

								// 既存のカテゴリ選択BOXに選択を反映
								$('#categorydiv input[type=\"checkbox\"]').each(function() {
										var termId = $(this).attr('id').split('-')[2]; // チェックボックスのIDからカテゴリのIDを抽出
										if (selected_categories.includes(termId)) {
												$(this).prop('checked', true);
										} else {
												$(this).prop('checked', false);
										}
								});
						});
						$('.tab-button').click(function() {
								var tab = $(this).data('tab');
								$('.tab-content').hide();
								$('.tab-content[data-tab=\"' + tab + '\"]').show();
						});
						
				});
		</script>
		";
}
add_action('admin_head', 'enqueue_category_admin_scripts');


function enqueue_category_admin_styles() {
		echo "
		<style>
				.category-tabs {
						display: flex;
						flex-wrap: wrap;
						gap: 10px;
						margin-bottom: 20px;
				}
				.tab-button {
						cursor: pointer;
						padding: 5px 10px;
						border: none;
						background-color: #f1f1f1;
				}
				.tab-content {
						display: none;
				}
				#category-popup {
						z-index: 99999; /* 他の要素より前面に表示 */
						width: 80vw; /* ポップアップの幅を80%にする */
				}
				.tab-content {
						display: flex;
						flex-wrap: wrap;
				}
				.tab-content div, .alphabet-group div {
						width: calc(33.33% - 10px); /* 3列のレイアウト */
						box-sizing: border-box; /* ボーダーやパディングを含めた幅・高さにする */
						margin-right: 5px;
						margin-left: 5px;
						margin-bottom: 10px;
				}
		</style>
		";
}
add_action('admin_head', 'enqueue_category_admin_styles');




// // // // // // // // // // // // // // // // // // // // // // // // // //
// カテゴリータブ追加　// 

// カスタムタブの追加
function add_recent_categories_meta_box() {
		add_meta_box(
				'recent_categories_meta_box',
				__('Recent Categories', 'your-text-domain'),
				'display_recent_categories_meta_box',
				'post',
				'side',
				'high'
		);
}
add_action('add_meta_boxes', 'add_recent_categories_meta_box');

function display_recent_categories_meta_box($post) {
		// 直近の投稿で選択されたカテゴリーを取得
		$recent_posts = wp_get_recent_posts(array('numberposts' => 1));
		$recent_categories = array();
		if (!empty($recent_posts)) {
				$recent_post_id = $recent_posts[0]['ID'];
				$recent_categories = wp_get_post_categories($recent_post_id);
		}

		// カテゴリーリストを生成
		if (!empty($recent_categories)) {
				echo '<ul>';
				foreach ($recent_categories as $category_id) {
						$category = get_category($category_id);
						echo '<li id="category-' . $category_id . '"><label><input value="' . $category_id . '" type="checkbox" name="post_category[]" id="in-category-' . $category_id . '"> ' . $category->name . '</label></li>';
				}
				echo '</ul>';
		} else {
				echo '<p>' . __('No recent categories found.', 'your-text-domain') . '</p>';
		}
}

// カテゴリーを保存する
function save_recent_categories_meta_box_data($post_id) {
		if (isset($_POST['post_category'])) {
				$categories = $_POST['post_category'];
				wp_set_post_categories($post_id, $categories);
		}
}
add_action('save_post', 'save_recent_categories_meta_box_data');








// spotifysearch 2023.09.21

function add_spotify_search_button_metabox() {
		add_meta_box('spotify-search-button-metabox', 'Spotify Search', 'render_spotify_search_button', 'post');
}
add_action('add_meta_boxes', 'add_spotify_search_button_metabox');

function render_spotify_search_button() {
		echo '<button id="spotify-search-button" type="button">Spotify Search</button>';
}


// spotifimage 2023.09.21

function add_custom_button_to_editor() {
		echo '<button id="custom-action-button" style="margin-top: 10px;">Execute Actions</button>';
}
add_action('edit_form_after_title', 'add_custom_button_to_editor');







// Chart.jsライブラリのエンキュー 2023.12.29
function my_enqueue_scripts() {
		// Chart.js をエンキュー
		wp_enqueue_script('chartjs', 'https://cdn.jsdelivr.net/npm/chart.js', [], '2.9.4', true);

// カスタムスクリプトをエンキュー
wp_enqueue_script('my-chart-script', get_template_directory_uri() . '/my-chart-script.js', ['chartjs'], '1.0.0', true);


		// PHPで処理したデータをJavaScriptに渡す
		wp_localize_script('my-chart-script', 'musicData', array(
				'mode' => get_post_meta(get_the_ID(), 'spotify_mode', true),
				'tempo' => get_post_meta(get_the_ID(), 'spotify_tempo', true),
				'danceability' => get_post_meta(get_the_ID(), 'spotify_danceability', true),
				'valence' => get_post_meta(get_the_ID(), 'spotify_valence', true),
				'instrumentalness' => get_post_meta(get_the_ID(), 'spotify_instrumentalness', true),
				'liveness' => get_post_meta(get_the_ID(), 'spotify_liveness', true),
				'speechiness' => get_post_meta(get_the_ID(), 'spotify_speechiness', true),
				'acousticness' => get_post_meta(get_the_ID(), 'spotify_acousticness', true),
				'key' => get_post_meta(get_the_ID(), 'spotify_key', true),
				'time_signature' => get_post_meta(get_the_ID(), 'spotify_time_signature', true),
				'loudness' => get_post_meta(get_the_ID(), 'spotify_loudness', true),
				'energy' => get_post_meta(get_the_ID(), 'spotify_energy', true),
		));
}
add_action('wp_enqueue_scripts', 'my_enqueue_scripts');


// ACF カテゴリー（アーティスト）画像アップロード コピー作成（名前の前に artist_ 追加） 20240529
// function create_artist_image_copy( $upload ) {
// 		// アップロードされたファイルのパスとURLを取得
// 		$file_path = $upload['file'];
// 		$file_url = $upload['url'];

		// ファイル情報を取得
// 		$path_parts = pathinfo( $file_path );
// 		$file_dir = $path_parts['dirname'];
// 		$file_name = $path_parts['filename'];
// 		$file_ext = $path_parts['extension'];

		// 新しいファイル名を生成
// 		$new_file_name = 'artist_' . $file_name . '.' . $file_ext;
// 		$new_file_path = $file_dir . '/' . $new_file_name;
// 		$new_file_url = str_replace( $file_name . '.' . $file_ext, $new_file_name, $file_url );

		// ファイルをコピー
// 		copy( $file_path, $new_file_path );

// 		return $upload;
// }
// add_filter( 'wp_handle_upload', 'create_artist_image_copy' );


// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // 


// アーチストJSON生成 20240604改定
function generate_artists_json() {
		// すべてのカテゴリーを取得する
		$categories = get_categories(array(
				'taxonomy' => 'category',
				'hide_empty' => false,
		));

		$artist_data = array();

		// カテゴリーごとにデータを処理する
		foreach ($categories as $category) {
				$artist_data[$category->name] = array(
						'id' => $category->term_id,
						'slug' => $category->slug,
				);
		}

		// JSONファイルのパスを指定する
		$upload_dir = wp_upload_dir();
		$json_file_path = $upload_dir['basedir'] . '/artists.json';

		// JSONデータをファイルに書き込む
		$json_data = json_encode($artist_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
		file_put_contents($json_file_path, $json_data);
}

// カテゴリーの新規登録または更新時に関数を実行する
add_action('created_category', 'generate_artists_json', 10, 2);
add_action('edited_category', 'generate_artists_json', 10, 2);
add_action('delete_category', 'generate_artists_json', 10, 2);





// カテゴリー編集ページに「Spotify IDを取得」と「Spotify Artist Info」ボタンを追加	20240601
function add_spotify_buttons_to_category_edit($term) {
		?>
		<div class="form-field">
				<label for="fetch-from-spotify">SpotifyからIDを取得:</label>
				<button type="button" id="fetch-from-spotify" class="button">Spotify IDを取得</button>
		</div>
		<div class="form-field">
				<label for="fetch-artist-info-from-spotify">Spotifyからアーティスト情報を取得:</label>
				<button type="button" id="fetch-artist-info-from-spotify" class="button">Spotify Artist Info</button>
		</div>
		<?php
}
add_action('category_edit_form_fields', 'add_spotify_buttons_to_category_edit');











// category-to-spotify.js スクリプトの読み込み	20240601
function enqueue_category_to_spotify_script() {
		if ('term.php' === $GLOBALS['pagenow'] && 'category' === $_GET['taxonomy']) {
				wp_enqueue_script('category-to-spotify', get_template_directory_uri() . '/category-to-spotify.js', array('jquery'), null, true);
				wp_localize_script('category-to-spotify', 'spotifyApiSettings', array(
						'ajax_url' => admin_url('admin-ajax.php'),
						'nonce' => wp_create_nonce('spotify_api_nonce')
				));
		}
}
add_action('admin_enqueue_scripts', 'enqueue_category_to_spotify_script');


// Spotify APIからアーティストIDを取得	20240601
function fetch_spotify_artist_id() {
		check_ajax_referer('spotify_api_nonce', 'nonce');

		if (!isset($_POST['artist_name']) || empty($_POST['artist_name'])) {
				wp_send_json_error('アーティストの名前が指定されていません。');
		}

		$client_id = '409da5333f634c4fbdfa4982f884ebcf'; // ここにSpotifyクライアントIDを入力
		$client_secret = '85f65c88f974475585ff92f54d91eea3'; // ここにSpotifyクライアントシークレットを入力

		wp_send_json_success(array(
				'client_id' => $client_id,
				'client_secret' => $client_secret
		));
}
add_action('wp_ajax_fetch_spotify_artist_id', 'fetch_spotify_artist_id');





function fetch_spotify_artist_images() {
		check_ajax_referer('spotify_api_nonce', 'nonce');

		if (!isset($_POST['artist_id']) || empty($_POST['artist_id'])) {
				wp_send_json_error('アーティストIDが指定されていません。');
		}

		$artist_id = sanitize_text_field($_POST['artist_id']);
		$client_id = '409da5333f634c4fbdfa4982f884ebcf'; // ここにSpotifyクライアントIDを入力
		$client_secret = '85f65c88f974475585ff92f54d91eea3'; // ここにSpotifyクライアントシークレットを入力

		// Spotifyトークンの取得
		$token_response = wp_remote_post('https://accounts.spotify.com/api/token', array(
				'body' => array(
						'grant_type' => 'client_credentials',
				),
				'headers' => array(
						'Authorization' => 'Basic ' . base64_encode($client_id . ':' . $client_secret),
				),
		));

		if (is_wp_error($token_response)) {
				wp_send_json_error('トークンの取得に失敗しました。');
		}

		$body = wp_remote_retrieve_body($token_response);
		$json = json_decode($body);

		if (!isset($json->access_token)) {
				wp_send_json_error('トークンの取得に失敗しました。');
		}

		$access_token = $json->access_token;

		// Spotify APIからアーティスト情報の取得
		$artist_response = wp_remote_get("https://api.spotify.com/v1/artists/{$artist_id}", array(
				'headers' => array(
						'Authorization' => "Bearer {$access_token}",
				),
		));

		if (is_wp_error($artist_response)) {
				wp_send_json_error('アーティスト情報の取得に失敗しました。');
		}

		$artist_body = wp_remote_retrieve_body($artist_response);
		$artist_json = json_decode($artist_body);

		if (!isset($artist_json->images) || empty($artist_json->images)) {
				wp_send_json_error('アーティスト画像が見つかりません。');
		}

		$images = array_map(function($image) {
				return $image->url;
		}, $artist_json->images);

		wp_send_json_success(array(
				'images' => $images,
		));
}
add_action('wp_ajax_fetch_spotify_artist_images', 'fetch_spotify_artist_images');






// 関連アーチスト取得 20240601
// カテゴリー編集ページに関連アーティストを追加するボタンを設置
function add_spotify_related_artists_button_to_category_edit($term) {
		?>
		<div class="form-field">
				<label for="fetch-related-artists-from-spotify">Spotifyから関連アーティストを取得:</label>
				<button type="button" id="fetch-related-artists-from-spotify" class="button">Spotify Related Artists</button>
		</div>
		<?php
}
add_action('category_edit_form_fields', 'add_spotify_related_artists_button_to_category_edit');

// スクリプトの読み込み
function enqueue_category_related_artists_to_spotify_script() {
		if ('term.php' === $GLOBALS['pagenow'] && 'category' === $_GET['taxonomy']) {
				wp_enqueue_script('category-related-artists-to-spotify', get_template_directory_uri() . '/category-related-artists-to-spotify.js', array('jquery'), null, true);
				wp_localize_script('category-related-artists-to-spotify', 'spotifyApiSettings', array(
						'ajax_url' => admin_url('admin-ajax.php'),
						'nonce' => wp_create_nonce('spotify_api_nonce'),
						'json_url' => 'https://xs867261.xsrv.jp/md/wp-content/uploads/artists.json'
				));
		}
}
add_action('admin_enqueue_scripts', 'enqueue_category_related_artists_to_spotify_script');



// Spotify APIから関連アーティスト情報を取得 20240604
// Spotify APIから関連アーティスト情報を取得 20240604
function fetch_spotify_related_artists() {
		check_ajax_referer('spotify_api_nonce', 'nonce');

		if (!isset($_POST['artist_id']) || empty($_POST['artist_id'])) {
				wp_send_json_error('アーティストIDが指定されていません。');
		}

		$artist_id = sanitize_text_field($_POST['artist_id']);
		$client_id = '409da5333f634c4fbdfa4982f884ebcf'; // ここにSpotifyクライアントIDを入力
		$client_secret = '85f65c88f974475585ff92f54d91eea3'; // ここにSpotifyクライアントシークレットを入力

		// Spotifyトークンの取得
		$token_response = wp_remote_post('https://accounts.spotify.com/api/token', array(
				'body' => array(
						'grant_type' => 'client_credentials',
				),
				'headers' => array(
						'Authorization' => 'Basic ' . base64_encode($client_id . ':' . $client_secret),
				),
		));

		if (is_wp_error($token_response)) {
				wp_send_json_error('トークンの取得に失敗しました。');
		}

		$body = wp_remote_retrieve_body($token_response);
		$json = json_decode($body);

		if (!isset($json->access_token)) {
				wp_send_json_error('トークンの取得に失敗しました。');
		}

		$access_token = $json->access_token;

		// Spotify APIから関連アーティスト情報の取得
		$related_artists_response = wp_remote_get("https://api.spotify.com/v1/artists/{$artist_id}/related-artists", array(
				'headers' => array(
						'Authorization' => "Bearer {$access_token}",
				),
		));

		if (is_wp_error($related_artists_response)) {
				wp_send_json_error('関連アーティスト情報の取得に失敗しました。');
		}

		$related_artists_body = wp_remote_retrieve_body($related_artists_response);
		$related_artists_json = json_decode($related_artists_body);

		if (!isset($related_artists_json->artists) || empty($related_artists_json->artists)) {
				wp_send_json_error('関連アーティストが見つかりません。');
		}

		$related_artists = array_map(function($artist) {
				return array(
						'name' => $artist->name,
						'id' => $artist->id,
						'uri' => $artist->uri,
				);
		}, $related_artists_json->artists);

		// WordPressのアーティストJSONを読み込む
		$wp_artists_response = wp_remote_get('https://xs867261.xsrv.jp/md/wp-content/uploads/artists.json');
		if (is_wp_error($wp_artists_response)) {
				wp_send_json_error('WordPressのアーティストJSONの取得に失敗しました。');
		}

		$wp_artists_body = wp_remote_retrieve_body($wp_artists_response);
		$wp_artists = json_decode($wp_artists_body, true);

		// $wp_artists のキーを小文字に変換
		$wp_artists_lowercase = array();
		foreach ($wp_artists as $name => $info) {
				$wp_artists_lowercase[strtolower($name)] = array_merge($info, ['original_name' => $name]);
		}

		// 取得した関連アーティストをフィルタリング
		$filtered_related_artists = array();
		foreach ($related_artists as $artist) {
				$artist_name = preg_replace('/^The\s+/i', '', $artist['name']); // "The"プレフィックスを削除
				$artist_name_lower = strtolower($artist_name); // 小文字に変換
				if (isset($wp_artists_lowercase[$artist_name_lower])) {
						$artist_info = $wp_artists_lowercase[$artist_name_lower];
						$filtered_related_artists[] = array(
								'name' => $artist_info['original_name'],
								'id' => $artist_info['id'],
								'slug' => $artist_info['slug']
						);
				} else {
						$filtered_related_artists[] = array(
								'name' => $artist_name
						);
				}
		}

		wp_send_json_success(array(
				'filtered_related_artists' => $filtered_related_artists,
		));
}
add_action('wp_ajax_fetch_spotify_related_artists', 'fetch_spotify_related_artists');


// // // // // // // // // // // // // // // // // // // // // // // // // // //// カスタム投稿タイプ : 「SP Artist」 2024.08.12

function create_sp_artist_post_type() {
		register_post_type('sp_artist',
				array(
						'labels' => array(
								'name' => __('SP Artists'),
								'singular_name' => __('SP Artist')
						),
						'public' => true,
						'has_archive' => true,
						'supports' => array('title', 'editor', 'thumbnail'),
						'show_in_rest' => true,
						'menu_position' => 5,
				)
		);
}
add_action('init', 'create_sp_artist_post_type');


// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // 


// 投稿タイプ「playlist」の作成
function create_playlist_post_type() {
		register_post_type('playlist',
				array(
						'labels' => array(
								'name' => __('Playlists'),
								'singular_name' => __('Playlist'),
								'add_new' => __('Add New Playlist'),
								'add_new_item' => __('Add New Playlist'),
								'edit_item' => __('Edit Playlist'),
								'new_item' => __('New Playlist'),
								'view_item' => __('View Playlist'),
								'search_items' => __('Search Playlists'),
								'not_found' => __('No playlists found'),
								'not_found_in_trash' => __('No playlists found in Trash'),
								'all_items' => __('All Playlists'),
								'menu_name' => __('Playlists'),
								'name_admin_bar' => __('Playlist')
						),
						'public' => true,
						'has_archive' => true,
						'rewrite' => array('slug' => 'playlist'),
						'supports' => array('title', 'editor', 'thumbnail'),
						'show_in_rest' => true, // REST APIのサポートを有効にする
						'hierarchical' => false,
						'publicly_queryable' => true,
						'show_ui' => true,
						'show_in_menu' => true,
						'menu_position' => 5, // メニューの位置を指定
						'menu_icon' => 'dashicons-playlist-audio', // アイコンを指定
						'taxonomies' => array('category', 'post_tag') // カテゴリーとタグをサポート
				)
		);
}
add_action('init', 'create_playlist_post_type');


// // // // // // // // // // // // // // // // // // // // // // // // // //


// 投稿タイプ「playlist」カスタムエンドポイントの作成
add_action('rest_api_init', function () {
		// プレイリスト一覧を取得するエンドポイント
		register_rest_route('custom/v1', '/playlists', array(
				'methods' => 'GET',
				'callback' => 'get_playlists',
		));

		// 特定のプレイリスト詳細を取得するエンドポイント
		register_rest_route('custom/v1', '/playlist/(?P<slug>[a-zA-Z0-9-]+)', array(
				'methods' => 'GET',
				'callback' => 'get_playlist_details',
				'args' => array(
						'slug' => array(
								'required' => true,
								'validate_callback' => function($param, $request, $key) {
										return is_string($param);
								}
						),
				),
		));
});

// プレイリスト一覧を取得する関数
function get_playlists() {
		// プレイリスト投稿タイプの取得
		$args = array(
				'post_type' => 'playlist',
				'posts_per_page' => -1, // すべてのプレイリストを取得
		);

		$query = new WP_Query($args);
		$playlists = array();

		// クエリからプレイリストの情報を取得
		if ($query->have_posts()) {
				while ($query->have_posts()) {
						$query->the_post();
						$id = get_the_ID();
						$playlists[] = array(
								'id' => $id,
								'title' => get_the_title(),
								'description' => get_the_content(),
								'thumbnail' => get_the_post_thumbnail_url($id, 'full'),
								'slug' => get_post_field('post_name', $id), // スラッグを追加
						);
				}
				wp_reset_postdata();
		}

		return rest_ensure_response($playlists);
}


// // // // // // // // // // // // // // // // // // // // // // // // // // //
// 特定のプレイリスト詳細を取得する関数




function get_playlist_details($request) {
		$playlist_slug = $request['slug'];

		$playlists = get_posts(array(
				'name' => $playlist_slug,
				'post_type' => 'playlist',
				'posts_per_page' => 1,
				'fields' => 'ids'
		));

		if (empty($playlists)) {
				return new WP_Error('no_playlist', 'プレイリストが見つかりません', array('status' => 404));
		}

		$playlist_id = $playlists[0];

		$args = array(
				'post_type' => 'post',
				'posts_per_page' => -1,
				'meta_query' => array(),
				'tax_query' => array(
						'relation' => 'AND'
				),
		);

		$playlist_genre = get_field('playlist_genre', $playlist_id);
		if ($playlist_genre) {
				$args['tax_query'][] = array(
						'taxonomy' => 'genre',
						'field' => 'term_id',
						'terms' => wp_list_pluck($playlist_genre, 'term_id'),
				);
		}

		// 他のタクソノミーのフィルタも含む
		$playlist_category = get_field('playlist_category', $playlist_id);
		$playlist_style = get_field('playlist_style', $playlist_id);
		$playlist_vocal = get_field('playlist_vocal', $playlist_id);
		$playlist_tag = get_field('playlist_tag', $playlist_id);

		if ($playlist_category) {
				$args['tax_query'][] = array(
						'taxonomy' => 'category',
						'field' => 'term_id',
						'terms' => wp_list_pluck($playlist_category, 'term_id'),
				);
		}

		if ($playlist_style) {
				$args['tax_query'][] = array(
						'taxonomy' => 'style',
						'field' => 'term_id',
						'terms' => wp_list_pluck($playlist_style, 'term_id'),
				);
		}

		if ($playlist_vocal) {
				$args['tax_query'][] = array(
						'taxonomy' => 'vocal',
						'field' => 'term_id',
						'terms' => wp_list_pluck($playlist_vocal, 'term_id'),
				);
		}

		if ($playlist_tag) {
				$args['tax_query'][] = array(
						'taxonomy' => 'post_tag',
						'field' => 'term_id',
						'terms' => wp_list_pluck($playlist_tag, 'term_id'),
				);
		}

		$query = new WP_Query($args);
		$songs = array();

		if ($query->have_posts()) {
				while ($query->have_posts()) {
						$query->the_post();
						$post_id = get_the_ID();

						// ACFとタクソノミーから必要な情報を取得
						$yt_video_id = get_field('ytvideoid', $post_id);
						$genre_terms = wp_get_post_terms($post_id, 'genre', array('fields' => 'names'));
						$vocal_terms = wp_get_post_terms($post_id, 'vocal', array('fields' => 'names'));
						$artist_terms = wp_get_post_terms($post_id, 'category', array('fields' => 'all'));	// アーティストデータ
						$post_date = get_the_date('Y-m-d', $post_id);
						$artist_order = get_field('artist_order', $post_id);
						$spotify_artists = get_field('spotify_artists', $post_id);
						$first_artist = !empty($artist_terms) ? $artist_terms[0]->name : null;	// 最初のアーティスト名

						// アーティストIDとスラッグも取得
						$artist_id = !empty($artist_terms) ? $artist_terms[0]->term_id : null;
						$artist_slug = !empty($artist_terms) ? $artist_terms[0]->slug : null;

						// アーティストの出身国
						$artist_origin = '';
						if ($first_artist) {
								$artist_category = get_term_by('name', $first_artist, 'category');
								if ($artist_category) {
										$artist_origin = get_field('artistorigin', 'category_' . $artist_category->term_id);
								}
						}

						// スラッグも含めて楽曲情報を返す
						$songs[] = array(
								'id' => $post_id,
								'title' => get_the_title($post_id),
								'slug' => get_post_field('post_name', $post_id), // タイトルのスラッグ
								'permalink' => get_permalink($post_id),
								'excerpt' => get_the_excerpt($post_id),
								'thumbnail' => get_the_post_thumbnail_url($post_id, 'thumbnail'),
								'yt_video_id' => $yt_video_id,
								'artists' => $artist_terms ? wp_list_pluck($artist_terms, 'name') : array('Unknown Artist'),
								'first_artist' => $first_artist,
								'first_artist_id' => $artist_id,	// アーティストID
								'first_artist_slug' => $artist_slug,	// アーティストスラッグ
								'genres' => $genre_terms,
								'vocals' => $vocal_terms,
								'post_date' => $post_date,
								'artist_order' => $artist_order,
								'spotify_artists' => $spotify_artists,
								'artist_origin' => $artist_origin,
						);
				}
		}

		wp_reset_postdata();

		$response = array(
				'id' => $playlist_id,
				'title' => get_the_title($playlist_id),
				'description' => get_post_field('post_content', $playlist_id),
				'thumbnail' => get_the_post_thumbnail_url($playlist_id),
				'songs' => $songs,
		);

		return rest_ensure_response($response);
}




// // // // // // // // // // // // // // // // // // // // // // // // // // // // // // 
// Next.js関係
// WordPress REST APIでサムネイル情報を取得
function add_custom_api_fields() {
		// サムネイル情報を追加
		register_rest_field('post', 'featured_media_url', array(
				'get_callback' => function ($post) {
						if ($thumbnail_id = get_post_thumbnail_id($post['id'])) {
								return wp_get_attachment_image_src($thumbnail_id, 'full')[0];
						}
						return false;
				},
		));

		// カスタムフィールドを含める
		register_rest_field('post', 'custom_fields', array(
				'get_callback' => function ($post) {
						$categories = get_the_category($post['id']);
						$cat_data = array();

						foreach ($categories as $category) {
								$acf_fields = get_fields('category_' . $category->term_id);
								$artist_origin = get_field('artist_origin', 'category_' . $category->term_id);
								$prefix = get_term_meta($category->term_id, 'the_prefix', true); // prefixフィールドの取得

								$cat_data[] = array(
										'id' => $category->term_id,
										'name' => $category->name,
										'slug' => $category->slug,
										'acf' => $acf_fields,
										'artist_origin' => $artist_origin,
										'prefix' => $prefix // prefixフィールドの追加
								);
						}

						$artist_order = get_field('artist_order', $post['id']);
						$spotify_artists = get_field('spotify_artists', $post['id']);
						$ytvideoid = get_field('ytvideoid', $post['id']);
						$spotify_track_id = get_field('spotify_track_id', $post['id']);

						return array(
								'categories' => $cat_data,
								'artist_order' => $artist_order,
								'spotify_artists' => $spotify_artists,
								'ytvideoid' => $ytvideoid,
								'spotify_track_id' => $spotify_track_id
						);
				},
		));


// タクソノミーデータを追加
register_rest_field('post', 'genre_data', array(
		'get_callback' => function ($object, $field_name, $request) {
				$genre_terms = wp_get_post_terms($object['id'], 'genre');
				$genre_data = array();

				if ($genre_terms && !is_wp_error($genre_terms)) {
						foreach ($genre_terms as $term) {
								// タームオブジェクトを取得
								$term_object = get_term($term->term_id);

								// タームごとの投稿数を取得
								$term_post_count = $term_object->count;

								$genre_data[] = array(
										'name' => $term->name,
										'slug' => $term->slug,
										'term_id' => $term->term_id,
										'post_count' => $term_post_count // 修正された部分
								);
						}
				}

				return $genre_data;
		},
		'update_callback' => null,
		'schema' => null,
));



		register_rest_field('post', 'vocal_data', array(
				'get_callback' => function ($object, $field_name, $request) {
						$vocal_terms = wp_get_post_terms($object['id'], 'vocal');
						$vocal_data = array();

						if ($vocal_terms && !is_wp_error($vocal_terms)) {
								foreach ($vocal_terms as $term) {
										$vocal_data[] = array(
												'name' => $term->name,
												'slug' => $term->slug,
												'term_id' => $term->term_id,
										);
								}
						}

						return $vocal_data;
				},
				'update_callback' => null,
				'schema' => null,
		));
}

add_action('rest_api_init', 'add_custom_api_fields');





// カテゴリー（アーティスト）総数の計算
add_action('rest_api_init', function () {
		register_rest_route('my_namespace/v1', '/artist-count', array(
				'methods' => 'GET',
				'callback' => 'get_artist_count',
		));
});

function get_artist_count() {
		$categories = get_categories(array(
				'taxonomy' => 'category', // アーティストを表すカテゴリーのタクソノミーを指定
				'hide_empty' => false, // 空のカテゴリーも含める
		));
		$artist_count = count($categories); // カテゴリーの総数を計算

		return new WP_REST_Response(array('count' => $artist_count), 200); // 総数をレスポンスとして返す
}

// アルファベット別カテゴリー（アーティスト）総数の計算
add_action('rest_api_init', function () {
		register_rest_route('my_custom_namespace/v1', '/artist-count/(?P<letter>[a-zA-Z])', array(
				'methods' => 'GET',
				'callback' => 'get_artist_count_by_letter',
				'args' => array(
						'letter' => array(
								'required' => true,
								'validate_callback' => function($param, $request, $key) {
										return is_string($param);
								}
						),
				),
		));
});


function get_artist_count_by_letter($data) {
		$letter = $data['letter']; // クエリパラメータから文字を取得

		// 正規表現を使用して、指定した文字で始まるカテゴリー（アーティスト）の取得
		$categories = get_categories(array(
				'taxonomy' => 'category',
				'hide_empty' => false,
				'search' => $letter . '*', // 名前が指定した文字で始まるものをフィルタリング
		));

		// フィルタリング結果をさらに絞り込む
		$filtered_categories = array_filter($categories, function($category) use ($letter) {
				return stripos($category->name, $letter) === 0; // カテゴリ名が指定した文字で始まるか確認
		});

		// 該当するカテゴリーの総数を計算
		$artist_count = count($filtered_categories); 

		return new WP_REST_Response(array('count' => $artist_count), 200); // 総数をレスポンスとして返す
}



// 20250113
/**
 * 高速に「指定アルファベットで始まるカテゴリー（アーティスト）」を返すエンドポイント
 */

add_action('rest_api_init', function () {
	register_rest_route('my_namespace/v1', '/artists-by-letter/(?P<letter>[a-zA-Z])', [
		'methods'  => 'GET',
		'callback' => 'get_artists_by_letter',
	]);
});

function get_artists_by_letter(WP_REST_Request $request) {
	global $wpdb;

	// 1) letter の取得 (先頭1文字だけ)
	$letter = $request->get_param('letter');
	$letter = substr($letter, 0, 1);
	$letter = esc_sql($letter);

	// 2) limit と offset を取得 (デフォルトlimit=20, offset=0 等)
	$limit = (int) $request->get_param('limit');
	$offset = (int) $request->get_param('offset');
	if ($limit <= 0) {
		$limit = 20; // なければデフォルト20
	}
	if ($offset < 0) {
		$offset = 0;
	}

	// 3) 全件数(totalCount)を返したい場合は COUNT(*) クエリも書いておくと便利
	//		例: totalCount を取得
	$count_sql = $wpdb->prepare("
		SELECT COUNT(*)
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name LIKE %s
	", $letter . '%');

	$totalCount = (int) $wpdb->get_var($count_sql);

	// 4) 実際のデータ取得 (limit & offset)
	$data_sql = $wpdb->prepare("
		SELECT t.term_id, t.name, t.slug, tt.count
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name LIKE %s
		ORDER BY t.name ASC
		LIMIT %d OFFSET %d
	", $letter . '%', $limit, $offset);

	$results = $wpdb->get_results($data_sql);

	// ACF 等が必要ならここで get_term_meta などをループ
	/*
	foreach ($results as &$term) {
		$term->artistorigin = get_term_meta($term->term_id, 'artistorigin', true);
	}
	*/

	// 5) 合体して返す
	// フロント側で "data.artists" や "data.totalCount" を使えるようにする
	$response = [
		'artists' => $results ?: [],
		'totalCount' => $totalCount
	];

	return new WP_REST_Response($response, 200);
}




/**
 * Plugin Name: My Namespace Artist Endpoints
 * Description: 「英字以外」で始まるカテゴリ(アーティスト)を limit/offset 付きで返すカスタムRESTエンドポイント
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * /my_namespace/v1/artists-other
 * → 英字 (A-Za-z) 以外で始まるカテゴリを取得するエンドポイント
 */
add_action('rest_api_init', function () {
	register_rest_route('my_namespace/v1', '/artists-other', [
		'methods' 						=> 'GET',
		'callback'						=> 'my_namespace_get_artists_other',	// 関数名を合わせる
		'permission_callback' => '__return_true', // WordPress 5.5+ 必須
	]);
});


/**
 * コールバック関数
 * 「英字以外で始まる」カテゴリを limit & offset で取得
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function my_namespace_get_artists_other(WP_REST_Request $request) {
	global $wpdb;

	// 1) limit / offset パラメータの取得
	$limit	= (int) $request->get_param('limit');
	$offset = (int) $request->get_param('offset');
	if ($limit <= 0) {
		$limit = 20; // デフォルト: 20件
	}
	if ($offset < 0) {
		$offset = 0;
	}

	// 2) 総件数 totalCount を数えるクエリ
	//	 「先頭が英字以外」で始まる → RLIKE '^[^A-Za-z]'
	$count_sql = "
		SELECT COUNT(*)
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name RLIKE '^[^A-Za-z]'
	";
	$totalCount = (int) $wpdb->get_var($count_sql);

	// 3) limit/offset 付き取得クエリ
	//	 「先頭が英字以外」で始まるカテゴリだけ
	$data_sql = $wpdb->prepare("
		SELECT t.term_id, t.name, t.slug, tt.count
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name RLIKE '^[^A-Za-z]'
		ORDER BY t.name ASC
		LIMIT %d OFFSET %d
	", $limit, $offset);

	$results = $wpdb->get_results($data_sql);

	// 4) ACFフィールド等が必要ならここで get_term_meta() する
	/*
	foreach ($results as &$term) {
		$term->artistorigin = get_term_meta($term->term_id, 'artistorigin', true);
	}
	*/

	// 5) 返却
	$response = [
		'artists' 	 => $results ?: [],
		'totalCount' => $totalCount,
	];
	return new WP_REST_Response($response, 200);
}






/**
 * Plugin Name: My Namespace Artist Endpoints
 * Description: アーティスト一覧を取得するためのカスタムエンドポイント群
 * Version: 1.0.0
 */

// セキュリティ: 直接アクセスを防ぐ (テーマの functions.php なら不要)
if (!defined('ABSPATH')) {
	exit;
}

/**
 * 「指定アルファベットで始まるカテゴリー」を limit/offset 付きで返すカスタムエンドポイント
 */
add_action('rest_api_init', function () {
	register_rest_route('my_namespace/v1', '/artists-other', [
		'methods' => 'GET',
		'callback' => 'my_namespace_get_artists_other',
	]);
});





/**
 * Plugin Name: My Namespace Artist Endpoints
 * Description: アルファベットで始まるカテゴリ(アーティスト)を limit/offset 付きで返すカスタムRESTエンドポイント
 * Version: 1.0.0
 */

// セキュリティ対策: テーマの functions.php ならこのチェックは不要
if (!defined('ABSPATH')) {
	exit;
}

/**
 * register_rest_route: my_namespace/v1/artists-by-letter/[letter]
 * このルートで英字で始まるカテゴリーを取得
 */



/**
 * コールバック関数
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function my_namespace_get_artists_by_letter(WP_REST_Request $request) {
	global $wpdb;

	// 1) パラメータ取得
	$letter = $request->get_param('letter');
	if (!is_string($letter) || $letter === '') {
		return new WP_REST_Response([
			'artists' 	 => [],
			'totalCount' => 0,
			'error' 		 => 'Invalid letter parameter',
		], 200);
	}
	// 先頭1文字だけを使う
	$letter = substr($letter, 0, 1);
	// SQLエスケープ
	$letter = esc_sql($letter);

	// limit / offset
	$limit	= (int) $request->get_param('limit');
	$offset = (int) $request->get_param('offset');
	if ($limit <= 0) {
		$limit = 20; // デフォルト: 20件
	}
	if ($offset < 0) {
		$offset = 0;
	}

	// 2) 総件数を数えるクエリ
	$count_sql = $wpdb->prepare("
		SELECT COUNT(*)
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name LIKE %s
	", $letter . '%');
	$totalCount = (int) $wpdb->get_var($count_sql);

	// 3) limit/offset を使った取得クエリ
	$data_sql = $wpdb->prepare("
		SELECT t.term_id, t.name, t.slug, tt.count
		FROM {$wpdb->terms} AS t
		INNER JOIN {$wpdb->term_taxonomy} AS tt ON t.term_id = tt.term_id
		WHERE tt.taxonomy = 'category'
			AND t.name LIKE %s
		ORDER BY t.name ASC
		LIMIT %d OFFSET %d
	", $letter . '%', $limit, $offset);

	// 4) データ取得
	$results = $wpdb->get_results($data_sql);

	// 5) ACFフィールド等を追加したい場合はここでループ:
	/*
	foreach ($results as &$term) {
		$term->artistorigin = get_term_meta($term->term_id, 'artistorigin', true);
	}
	*/

	// 6) 配列の形で返す
	$response = [
		'artists' 	 => $results ?: [],
		'totalCount' => $totalCount,
	];

	// WP_REST_Response で返す
	return new WP_REST_Response($response, 200);
}





// サムネールを spotify_imagesフィールドから画像のURLを取得	Next.js関係
// 画像URLからアタッチメントを作成し、任意の名前(投稿本文に基づくファイル名の生成)で保存する関数
function insert_attachment_from_url_with_body_content($image_url, $post_id) {
		// 画像データを一時ダウンロード
		$temp_file = download_url($image_url);
		if (is_wp_error($temp_file)) {
				return false;
		}

		// ファイル拡張子を取得
		$file_extension = pathinfo(parse_url($image_url, PHP_URL_PATH), PATHINFO_EXTENSION);
		if (!$file_extension) {
				$file_extension = 'jpg'; // 拡張子が取得できない場合、デフォルトでjpgを使用
		}

		// 投稿本文の内容を取得
		$post_content = get_post_field('post_content', $post_id);
		if (!$post_content) {
				return false; // 本文が空の場合は処理を終了
		}

		// 本文から適切な値を抽出（例: 最初の100文字をスラッグとして利用）
		$slug = sanitize_title(mb_substr($post_content, 0, 100));

		// ファイル名を生成
		$custom_file_name = sanitize_file_name($slug . '.' . $file_extension);

		// ファイル情報を準備
		$file = [
				'name'		 => $custom_file_name,
				'type'		 => mime_content_type($temp_file),
				'tmp_name' => $temp_file,
				'error' 	 => 0,
				'size'		 => filesize($temp_file),
		];

		// ファイルをWordPressにアップロード
		$overrides = ['test_form' => false];
		$attachment_id = media_handle_sideload($file, $post_id);

		// アップロード失敗時の処理
		if (is_wp_error($attachment_id)) {
				@unlink($temp_file); // 一時ファイルを削除
				return false;
		}

		return $attachment_id;
}

// 投稿保存時にアイキャッチ画像を設定する関数
function set_custom_post_thumbnail_from_acf($post_id) {
		// 既にアイキャッチ画像が設定されている場合はスキップ
		if (has_post_thumbnail($post_id)) {
				return;
		}

		// ACFから必要なフィールドを取得
		if (function_exists('get_field')) {
				$image_url = get_field('spotify_images', $post_id);

				if ($image_url) {
						// 本文を利用してファイル名を生成し、画像を保存
						$attach_id = insert_attachment_from_url_with_body_content($image_url, $post_id);
						if ($attach_id) {
								set_post_thumbnail($post_id, $attach_id);
						}
				}
		}
}
add_action('save_post', 'set_custom_post_thumbnail_from_acf');

// // // // // // // // // // // // // // // // // // // // // // // // // // 





// // // // // // // // // // // // // // // // // // // // // // // // // // 
function add_custom_category_fields() {
		register_rest_field('category', 'the_prefix', array(
				'get_callback' => function($category) {
						return get_term_meta($category['id'], 'the_prefix', true);
				},
		));
}
add_action('rest_api_init', 'add_custom_category_fields');



function insert_attachment_from_url($url, $parent_post_id = null) {
		if (!class_exists('WP_Http')) {
				include_once(ABSPATH . 'wp-includes/class-http.php');
		}

		$http = new WP_Http();
		$response = $http->request($url);
		if ($response['response']['code'] != 200 || empty($response['body'])) {
				return false;
		}

		$file_contents = $response['body'];
		$finfo = new finfo(FILEINFO_MIME_TYPE);
		$mime_type = $finfo->buffer($file_contents);
		$file_ext = '';
		switch ($mime_type) {
				case 'image/jpeg':
						$file_ext = '.jpg';
						break;
				case 'image/png':
						$file_ext = '.png';
						break;
		}

		if ($file_ext === '') {
				return false;
		}

		$upload = wp_upload_bits(basename($url) . $file_ext, null, $file_contents);
		if (!empty($upload['error'])) {
				return false;
		}

		$file_path = $upload['file'];
		$file_name = basename($file_path);
		$attachment = array(
				'post_mime_type' => $mime_type,
				'post_title' => preg_replace('/\.[^.]+$/', '', $file_name),
				'post_content' => '',
				'post_status' => 'inherit',
		);

		$attach_id = wp_insert_attachment($attachment, $file_path, $parent_post_id);
		require_once(ABSPATH . 'wp-admin/includes/image.php');
		$attach_data = wp_generate_attachment_metadata($attach_id, $file_path);
		wp_update_attachment_metadata($attach_id, $attach_data);

		return $attach_id;
}


add_action( 'rest_api_init', function () {
	register_rest_route( 'mytheme/v1', '/artist-posts/(?P<slug>[a-zA-Z0-9-]+)', array(
		'methods' => 'GET',
		'callback' => 'get_artist_posts',
		'args' => array(
			'slug' => array(
				'required' => true,
				'validate_callback' => function($param, $request, $key) {
					return is_string($param);
				}
			),
		),
	));
});

function get_artist_posts( $data ) {
	$posts_data = array();
	$slug = $data['slug'];
	$category = get_category_by_slug($slug); // カテゴリーIDをスラッグから取得

	if ( $category ) {
		$posts = get_posts(array(
			'category' => $category->term_id,
			'posts_per_page' => -1, // ここで取得する投稿数を制限
		));

		foreach ($posts as $post) {
			$posts_data[] = array(
				'id' => $post->ID,
				'title' => $post->post_title,
				'date' => $post->post_date,
				// 必要なデータをここに追加
			);
		}

		return new WP_REST_Response($posts_data, 200);
	} else {
		return new WP_Error('no_posts', __('No posts found for this artist', 'text-domain'), array('status' => 404));
	}
}


// Charts カスタム投稿タイプの登録	Next.js関係 20240327
function create_charts_post_type() {
		register_post_type('charts',
				array(
						'labels' => array(
								'name' => __('Charts'),
								'singular_name' => __('Chart')
						),
						'public' => true,
						'has_archive' => true,
						'rewrite' => array('slug' => 'charts'),
						'supports' => array('title', 'editor', 'excerpt', 'thumbnail', 'comments'),
						'show_in_rest' => true, // この行を追加するとGutenbergエディタが有効になります。
				)
		);
}
add_action('init', 'create_charts_post_type');

function add_charts_to_home_query( $query ) {
		if ( $query->is_home() && $query->is_main_query() ) {
				// ホームページのクエリに 'charts' 投稿タイプを含める
				$query->set( 'post_type', array( 'post', 'charts' ) );
		}
}
add_action( 'pre_get_posts', 'add_charts_to_home_query' );



// Charts 「国別」カスタム分類の追加	Next.js関係
function create_country_taxonomy() {
		$labels = array(
				'name'							=> _x( 'Countries', 'taxonomy general name' ),
				'singular_name' 		=> _x( 'Country', 'taxonomy singular name' ),
				'search_items'			=> __( 'Search Countries' ),
				'all_items' 				=> __( 'All Countries' ),
				'parent_item' 			=> __( 'Parent Country' ),
				'parent_item_colon' => __( 'Parent Country:' ),
				'edit_item' 				=> __( 'Edit Country' ),
				'update_item' 			=> __( 'Update Country' ),
				'add_new_item'			=> __( 'Add New Country' ),
				'new_item_name' 		=> __( 'New Country Name' ),
				'menu_name' 				=> __( 'Country' ),
		);

		$args = array(
				'hierarchical'			=> true, // Make it hierarchical (like categories)
				'labels'						=> $labels,
				'show_ui' 					=> true,
				'show_admin_column' => true,
				'query_var' 				=> true,
				'rewrite' 					=> array( 'slug' => 'country' ),
		);

		register_taxonomy( 'country', array( 'charts' ), $args );
}
add_action( 'init', 'create_country_taxonomy', 0 );


// Charts  Next.js関係
function create_year_taxonomy() {
		$labels = array(
				'name'							=> _x( 'Years', 'taxonomy general name' ),
				'singular_name' 		=> _x( 'Year', 'taxonomy singular name' ),
				'search_items'			=> __( 'Search Years' ),
				'all_items' 				=> __( 'All Years' ),
				'parent_item' 			=> __( 'Parent Year' ),
				'parent_item_colon' => __( 'Parent Year:' ),
				'edit_item' 				=> __( 'Edit Year' ),
				'update_item' 			=> __( 'Update Year' ),
				'add_new_item'			=> __( 'Add New Year' ),
				'new_item_name' 		=> __( 'New Year Name' ),
				'menu_name' 				=> __( 'Year' ),
		);

		$args = array(
				'hierarchical'			=> true, // Make it hierarchical (like categories)
				'labels'						=> $labels,
				'show_ui' 					=> true,
				'show_admin_column' => true,
				'query_var' 				=> true,
				'rewrite' 					=> array( 'slug' => 'year' ),
		);

		register_taxonomy( 'year', array( 'charts' ), $args );
}
add_action( 'init', 'create_year_taxonomy', 0 );


// Chart のカスタムタクソノミーのデータをREST APIに含める  Next.js関係
function add_custom_taxonomies_terms_to_charts_json_response( $response, $post, $context ) {
		// カスタムタクソノミー 'country' のタームを取得してレスポンスに追加
		$countries = wp_get_post_terms( $post->ID, 'country', array( 'fields' => 'names' ) );
		$response->data['country'] = $countries;

		// カスタムタクソノミー 'year' のタームを取得してレスポンスに追加
		$years = wp_get_post_terms( $post->ID, 'year', array( 'fields' => 'names' ) );
		$response->data['year'] = $years;

		return $response;
}
add_filter( 'rest_prepare_charts', 'add_custom_taxonomies_terms_to_charts_json_response', 10, 3 );



// ACFフィールドをREST APIレスポンスに含めるためのフィルター
function register_custom_api_endpoints() {
		register_rest_route('mytheme/v1', '/chart-songs/(?P<year>\d+)', array(
				'methods' => 'GET',
				'callback' => 'get_songs_for_chart',
				'args' => array(
						'year' => array(
								'required' => true,
								'validate_callback' => function($param, $request, $key) {
										return is_numeric($param);
								}
						),
				),
		));
}

add_action('rest_api_init', 'register_custom_api_endpoints');



// チャート情報取得のためのカスタムエンドポイントを追加  Next.js関係
add_action( 'rest_api_init', function () {
		register_rest_route( 'mycustom/v1', '/chart-songs/(?P<slug>[a-zA-Z0-9-]+)', array(
				'methods' => WP_REST_Server::READABLE,
				'callback' => 'get_songs_for_chart',
				'args' => array(
						'slug' => array(
								'validate_callback' => function($param, $request, $key) {
										return is_string($param);
								}
						),
				),
		));
});

function get_songs_for_chart( WP_REST_Request $request ) {
		$slug = $request['slug'];
		$chart_post = get_posts(array(
				'name' => $slug,
				'post_type' => 'charts',
				'numberposts' => 1
		));

		if (empty($chart_post)) {
				return new WP_Error( 'no_chart', 'No chart found', array( 'status' => 404 ) );
		}

		$chart_id = $chart_post[0]->ID;
		$songs_list = [];

		for ($i = 1; $i <= 6; $i++) {
				$chart_name_key = 'chart_name' . $i;
				$chart_position_key = 'chart_position' . $i;

				$args = array(
						'post_type' => 'post',
						'posts_per_page' => -1,
						'meta_query' => array(
								array(
										'key' => $chart_name_key,
										'value' => $chart_id,
										'compare' => '='
								),
								array(
										'key' => $chart_position_key,
										'compare' => 'EXISTS'
								)
						)
				);

				$songs = get_posts($args);

				foreach ($songs as $song) {
						$chart_position = get_post_meta($song->ID, $chart_position_key, true);
						if (!empty($chart_position)) {
								$songs_list[] = array(
										'ID' => $song->ID,
										'title' => get_the_title($song->ID),
										'position' => $chart_position,
										// 他に必要な情報があればここに追加
								);
						}
				}
		}

		usort($songs_list, function ($a, $b) {
				return $a['position'] - $b['position'];
		});

		return rest_ensure_response($songs_list);
}

// // // // // // // // // // // // // // // // // // // // // // // // // // //
// 検索用アーチストJSONデータを生成 Next.js関係 20240604

// 管理画面にメニューを追加
function add_generate_json_menu() {
		add_submenu_page(
				'tools.php', // 親メニュー
				'Generate Music JSON', // ページタイトル
				'Generate Music JSON', // メニュータイトル
				'manage_options', // 権限
				'generate-music-json', // メニューのスラッグ
				'generate_music_json_page' // コールバック関数
		);
}
add_action('admin_menu', 'add_generate_json_menu');

// メニューページのコールバック関数
function generate_music_json_page() {
		if (isset($_POST['generate_json'])) {
				generate_music_json();
				echo '<div class="updated"><p>JSONファイルが生成されました。</p></div>';
		}
		// アップロードディレクトリを確認
		$upload_dir = wp_upload_dir();
		?>
		<div class="wrap">
				<h2>Generate Music JSON</h2>
				<form method="post">
						<input type="hidden" name="generate_json" value="1">
						<p>
								<input type="submit" class="button-primary" value="Generate JSON">
						</p>
				</form>
				<p>Upload directory: <?php echo $upload_dir['basedir']; ?></p>
		</div>
		<?php
}




// JSONファイルを生成する関数
function generate_music_json() {
		$posts_per_batch = 100; // バッチごとの投稿数
		$offset = 0; // 初期オフセット
		$music_data = array();

		while (true) {
				$args = array(
						'post_type' => 'post',
						'posts_per_page' => $posts_per_batch,
						'post_status' => 'publish',
						'offset' => $offset,
				);
				$posts = get_posts($args);

				if (empty($posts)) {
						break; // 取得する投稿がなくなったらループを終了
				}

				foreach ($posts as $post) {
						$categories = get_the_category($post->ID);
						if (!$categories || is_wp_error($categories)) {
								continue; // カテゴリが取得できない場合は次の投稿へ
						}
						$category_data = array();

						foreach ($categories as $category) {
								$artistjpname = get_field('artistjpname', 'category_' . $category->term_id);
								$category_data[] = array(
										'name' => $category->name,
										'slug' => $category->slug,
										'artistjpname' => $artistjpname
								);
						}

						$music_data[] = array(
								'title' => get_the_title($post->ID),
								'title_slug' => $post->post_name,
								'artists' => $category_data,
								'release_date' => get_the_date('Y-m-d', $post->ID) // 公開日を追加
						);
				}

				$offset += $posts_per_batch; // オフセットを更新して次のバッチを取得
		}

		// JSONファイルのパスを指定する
		$upload_dir = wp_upload_dir();
		$json_file_path = $upload_dir['basedir'] . '/music_data.json';

		// JSONデータをファイルに書き込む
		$json_data = json_encode($music_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
		if (file_put_contents($json_file_path, $json_data) === false) {
				error_log('Failed to write JSON data to file');
		} else {
				error_log('JSON data successfully written to file');
		}
}

// JSON生成機能の手動実行
add_action('admin_menu', function() {
		add_submenu_page(
				'tools.php',						// 親メニュー
				'Generate JSON',				// ページタイトル
				'Generate JSON',				// メニュータイトル
				'manage_options', 			// 権限
				'generate-json',				// スラッグ
				function() {						// コールバック関数
						if (isset($_POST['generate_json'])) {
								generate_music_json();
								echo '<div class="notice notice-success"><p>JSONファイルが生成されました。</p></div>';
						}
						echo '<div class="wrap">';
						echo '<h1>Generate JSON</h1>';
						echo '<form method="post">';
						echo '<input type="submit" name="generate_json" class="button button-primary" value="Generate JSON">';
						echo '</form>';
						echo '</div>';
				}
		);
});


// // // // // // // // // // // // // // // // // // // // // // // // // //
// Next.js関係
// サイトマップ用　カスタム分類の登録　20240616

function register_custom_taxonomies() {
		// スタイルのカスタム分類
		register_taxonomy(
				'style',
				'post',
				array(
						'label' => __( 'Styles' ),
						'rewrite' => array( 'slug' => 'styles' ),
						'hierarchical' => true,
						'show_in_rest' => true, // これを追加
				)
		);

		// ジャンルのカスタム分類
		register_taxonomy(
				'genre',
				'post',
				array(
						'label' => __( 'Genres' ),
						'rewrite' => array( 'slug' => 'genres' ),
						'hierarchical' => true,
						'show_in_rest' => true, // これを追加
				)
		);
}

add_action( 'init', 'register_custom_taxonomies', 0 );


// // // // // // // // // // // // // // // // // // // // // // // // // //
// Next.js関係
// WP用　サイトマップXML アーティスト（カテゴリー）　20240617

if (!function_exists('generate_artist_sitemap')) {
		function generate_artist_sitemap() {
				$artists = get_terms(array(
						'taxonomy' => 'category',
						'hide_empty' => false,
				));

				$xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');

				foreach ($artists as $artist) {
						$artist_url = get_term_link($artist);
						if (is_wp_error($artist_url)) {
								continue;
						}

						$artist_url = str_replace('https://xs867261.xsrv.jp/md/category/', 'https://www.music8.jp/', $artist_url);

						$url = $xml->addChild('url');
						$url->addChild('loc', $artist_url);
						$url->addChild('lastmod', date('c', time()));
						$url->addChild('changefreq', 'weekly');
						$url->addChild('priority', '0.8');
				}

				$xml->asXML(ABSPATH . 'artist-sitemap.xml');
		}
}

if (!function_exists('generate_tag_sitemap')) {
		function generate_tag_sitemap() {
				$tags = get_terms(array(
						'taxonomy' => 'post_tag',
						'hide_empty' => false,
				));

				$xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');

				foreach ($tags as $tag) {
						$tag_url = get_term_link($tag);
						if (is_wp_error($tag_url)) {
								continue;
						}

						$tag_url = str_replace('https://xs867261.xsrv.jp/md/tag/', 'https://www.music8.jp/tag/', $tag_url);

						$url = $xml->addChild('url');
						$url->addChild('loc', $tag_url);
						$url->addChild('lastmod', date('c', time()));
						$url->addChild('changefreq', 'weekly');
						$url->addChild('priority', '0.8');
				}

				$xml->asXML(ABSPATH . 'tag-sitemap.xml');
		}
}

if (!function_exists('generate_genre_sitemap')) {
		function generate_genre_sitemap() {
				$genres = get_terms(array(
						'taxonomy' => 'genre', // カスタムタクソノミー 'genre'
						'hide_empty' => false,
				));

				$xml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');

				foreach ($genres as $genre) {
						$genre_url = get_term_link($genre);
						if (is_wp_error($genre_url)) {
								continue;
						}

						$genre_url = str_replace('https://xs867261.xsrv.jp/md/genres/', 'https://www.music8.jp/genres/', $genre_url);

						$url = $xml->addChild('url');
						$url->addChild('loc', $genre_url);
						$url->addChild('lastmod', date('c', time()));
						$url->addChild('changefreq', 'weekly');
						$url->addChild('priority', '0.8');
				}

				$xml->asXML(ABSPATH . 'genre-sitemap.xml');
		}
}

if (!function_exists('add_sitemap_generator_menu')) {
		function add_sitemap_generator_menu() {
				add_menu_page(
						'Sitemap Generator',
						'Sitemap Generator',
						'manage_options',
						'sitemap-generator',
						'sitemap_generator_page'
				);
		}
		add_action('admin_menu', 'add_sitemap_generator_menu');
}

if (!function_exists('sitemap_generator_page')) {
		function sitemap_generator_page() {
				if (isset($_POST['generate_artist_sitemap'])) {
						generate_artist_sitemap();
						echo '<div class="updated"><p>アーティスト専用サイトマップが生成されました。</p></div>';
				}
				if (isset($_POST['generate_tag_sitemap'])) {
						generate_tag_sitemap();
						echo '<div class="updated"><p>タグ専用サイトマップが生成されました。</p></div>';
				}
				if (isset($_POST['generate_genre_sitemap'])) {
						generate_genre_sitemap();
						echo '<div class="updated"><p>ジャンル専用サイトマップが生成されました。</p></div>';
				}
				?>
				<div class="wrap">
						<h1>サイトマップジェネレーター</h1>
						<form method="post">
								<input type="hidden" name="generate_artist_sitemap" value="1" />
								<?php submit_button('アーティストサイトマップを生成'); ?>
						</form>
						<form method="post">
								<input type="hidden" name="generate_tag_sitemap" value="1" />
								<?php submit_button('タグサイトマップを生成'); ?>
						</form>
						<form method="post">
								<input type="hidden" name="generate_genre_sitemap" value="1" />
								<?php submit_button('ジャンルサイトマップを生成'); ?>
						</form>
				</div>
				<?php
		}
}



// // // // // // // // // // // // // // // // // // // // // // // // // //
// Next.js関係
// WP サムネールアップロード時にwebp生成	20250111


add_filter('wp_handle_upload', 'create_custom_webp_thumbnail', 10, 2);

function create_custom_webp_thumbnail($upload, $context) {
		// アップロードが成功しているか、画像ファイルか確認
		if (isset($upload['type']) && strpos($upload['type'], 'image') !== false) {
				$file_path = $upload['file'];
				$file_info = pathinfo($file_path);
				
				// JPGまたはJPEGファイルのみ処理
				if (in_array(strtolower($file_info['extension']), ['jpg', 'jpeg'])) {
						// 画像を50x50ピクセルにリサイズ
						$resized_image = resize_image($file_path, 50, 50);
						
						if ($resized_image) {
								// リサイズした画像をWebP形式に変換
								$webp_image_path = convert_to_webp($resized_image, $file_info);
								
								if ($webp_image_path) {
										// 必要に応じて、WebP画像をメディアライブラリに追加
										add_webp_to_media_library($webp_image_path);
								}
						}
				}
		}
		
		return $upload;
}

function resize_image($file_path, $width, $height) {
		// 画像をロード
		$image = wp_get_image_editor($file_path);
		
		if (!is_wp_error($image)) {
				// 画像をリサイズ
				$image->resize($width, $height, true);
				
				// リサイズした画像のパスを設定（例: original-50x50.jpg）
				$resized_path = str_replace('.', "-{$width}x{$height}.", $file_path);
				$saved = $image->save($resized_path);
				
				if (!is_wp_error($saved)) {
						return $resized_path;
				}
		}
		
		return false;
}

function convert_to_webp($resized_path, $file_info) {
		// GDライブラリがWebPをサポートしているか確認
		if (!function_exists('imagewebp')) {
				return false;
		}
		
		// リサイズした画像を読み込む
		$image = imagecreatefromstring(file_get_contents($resized_path));
		
		if ($image === false) {
				return false;
		}
		
		// WebPファイルのパスを設定（例: Ringo-Starr-Look-Up.webp）
		$upload_dir = wp_upload_dir();
		$relative_path = str_replace($upload_dir['basedir'] . '/', '', $resized_path);
		$webp_relative_path = preg_replace('/-50x50\.(jpg|jpeg)$/i', '.webp', $relative_path);
		$webp_path = $upload_dir['basedir'] . '/' . $webp_relative_path;
		
		// WebP形式で保存
		$webp_saved = imagewebp($image, $webp_path);
		imagedestroy($image);
		
		if ($webp_saved) {
				return $webp_path;
		}
		
		return false;
}

function add_webp_to_media_library($webp_image_path) {
		$filetype = wp_check_filetype(basename($webp_image_path), null);
		$wp_upload_dir = wp_upload_dir();
		
		$attachment = array(
				'guid'					 => $wp_upload_dir['url'] . '/' . basename($webp_image_path), 
				'post_mime_type' => $filetype['type'],
				'post_title'		 => preg_replace('/\.[^.]+$/', '', basename($webp_image_path)),
				'post_content'	 => '',
				'post_status' 	 => 'inherit'
		);
		
		$attach_id = wp_insert_attachment( $attachment, $webp_image_path );
		
		// 添付ファイルのメタデータを生成
		require_once(ABSPATH . 'wp-admin/includes/image.php');
		$attach_data = wp_generate_attachment_metadata( $attach_id, $webp_image_path );
		wp_update_attachment_metadata( $attach_id, $attach_data );
}




























// // // // // // // // // // // // // // // // // // // // // // // // // //
// Next.js関係（App router変更） 20250125
// スタイルページ　不要な項目を省いた簡潔なカスタムエンドポイント

/**
 * カスタムエンドポイントのコールバック関数
 */
function get_songlist_data($request) {
		$style_id = intval($request->get_param('style_id'));
		$per_page = intval($request->get_param('per_page'));
		$page = intval($request->get_param('page'));

		// スタイルIDからスラッグを取得
		$style_slug = get_term_field('slug', $style_id, 'style');
		if (is_wp_error($style_slug) || !$style_slug) {
				return new WP_Error('invalid_style', '指定されたスタイルIDは無効です。', array('status' => 400));
		}

		// 投稿データのクエリ設定
		$args = array(
				'post_type' 		 => 'post',
				'posts_per_page' => $per_page,
				'paged' 				 => $page,
				'tax_query' 		 => array(
						array(
								'taxonomy' => 'style',
								'field' 	 => 'slug',
								'terms' 	 => $style_slug,
						),
				),
				'orderby' => 'date',
				'order' 	=> 'DESC',
		);

		$query = new WP_Query($args);
		$posts = array();

		if ($query->have_posts()) {
				foreach ($query->posts as $post) {
						$post_id = $post->ID;

						// ★ カテゴリー情報 (アーティスト) の取得
						$category_terms = wp_get_post_terms($post_id, 'category', array('fields' => 'all'));

						// each term => array
						$categories = array_map(function ($term) {
								// ここで 「the_prefix」カスタムフィールドをチェック
								// 値が '1' ならアーティスト名の先頭に 'The ' を付ける
								$the_prefix = get_field('the_prefix', 'category_' . $term->term_id);
								$cat_name 	= $term->name;
								if ($the_prefix === '1') {
										$cat_name = 'The ' . $cat_name;
								}

								return array(
										'term_id' 			=> $term->term_id,
										'name'					=> $cat_name,
										'slug'					=> $term->slug,
										'artistjpname'	=> get_field('artistjpname', 'category_' . $term->term_id) ?: null,
										'artistorigin'	=> get_field('artistorigin', 'category_' . $term->term_id) ?: 'Unknown',
								);
						}, $category_terms);

						// ジャンル情報
						$genre_terms = wp_get_post_terms($post_id, 'genre', array('fields' => 'all'));
						$genres = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $genre_terms);

						// スタイル情報
						$style_terms = wp_get_post_terms($post_id, 'style', array('fields' => 'all'));
						$styles = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $style_terms);

						// ボーカル情報
						$vocal_terms = wp_get_post_terms($post_id, 'vocal', array('fields' => 'all'));
						$vocals = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $vocal_terms);

						// 必要なデータを収集
						$posts[] = array(
								'id'								=> $post->ID,
								'date'							=> $post->post_date,
								'slug'							=> $post->post_name,
								'title' 						=> array(
										'rendered' => $post->post_title,
								),
								'content' 					=> array(
										'rendered' => $post->post_content,
								),
								'featured_media_url'=> get_the_post_thumbnail_url($post_id, 'full'),
								'categories'				=> $categories,
								'genre' 						=> $genres,
								'style' 						=> $styles,
								'vocal_data'				=> $vocals,
								'acf' => array(
										'ytvideoid' 						 => get_field('ytvideoid', $post_id),
										'spotify_track_id'			 => get_field('spotify_track_id', $post_id),
										'spotify_artists' 			 => get_field('spotify_artists', $post_id),
										'spotify_name'					 => get_field('spotify_name', $post_id),
										'spotify_images'				 => get_field('spotify_images', $post_id),
										'artist_order'					 => get_field('artist_order', $post_id),
										'likecount' 						 => get_field('likecount', $post_id) ?: null,
										'pvstyle' 							 => get_field('pvstyle', $post_id),
										'spotify_release_date'	 => get_field('spotify_release_date', $post_id),
								),
						);
				}
				wp_reset_postdata();
		}

		// プレイリスト情報 (不要であれば削除)
		$playlists = array();
		$playlist_query = new WP_Query(array(
				'post_type' 		 => 'playlist',
				'posts_per_page' => -1,
				'fields'				 => 'ids',
		));
		if ($playlist_query->have_posts()) {
				foreach ($playlist_query->posts as $playlist_id) {
						$playlists[] = array(
								'title' => get_the_title($playlist_id),
								'slug'	=> get_post_field('post_name', $playlist_id),
								'count' => wp_count_posts('playlist')->publish,
						);
				}
		}

		// レスポンス生成
		$response = array(
				'posts' 		=> $posts,
				'playlists' => $playlists,
				'total' 		=> (int) $query->found_posts,
				'max_num_pages' => (int) $query->max_num_pages,
		);

		// レスポンスヘッダー(任意)
		header('X-WP-Total: ' . $query->found_posts);
		header('X-WP-TotalPages: ' . $query->max_num_pages);

		return rest_ensure_response($response);
}



add_action('rest_api_init', function () {
		register_rest_route('custom/v1', '/songlist', array(
				'methods'  => 'GET',
				'callback' => 'get_songlist_data',
				'args'		 => array(
						'style_id' => array(
								'required' => true,
								'validate_callback' => function ($param) {
										return is_numeric($param);
								},
						),
						'per_page' => array(
								'required' => false,
								'default'  => 20,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
						'page' => array(
								'required' => false,
								'default'  => 1,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
				),
				'permission_callback' => '__return_true',
		));
});









// functions.php またはカスタムプラグイン内

function add_custom_cors_headers() {
		// Preflight リクエストへの対応
		if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
				header("Access-Control-Allow-Origin: *");
				header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
				header("Access-Control-Allow-Headers: Content-Type, Authorization");
				exit;
		}

		// 実際のリクエストへの対応
		header("Access-Control-Allow-Origin: *");
		header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
		header("Access-Control-Allow-Headers: Content-Type, Authorization");
}

add_action('rest_api_init', 'add_custom_cors_headers', 15);


















// functions.php またはカスタムプラグイン内

/**
 * ジャンルスラッグを受け取るカスタムエンドポイントのコールバック関数
 */
/**
 * ジャンルスラッグを受け取るカスタムエンドポイントのコールバック関数
 * Endpoint: /wp-json/custom/v1/genre-songlist?genre_slug=xxx
 */
function get_genre_songlist_data_by_slug($request) {
		// 1) パラメータ取得
		$genre_slug = sanitize_text_field($request->get_param('genre_slug'));
		$per_page 	= intval($request->get_param('per_page'));
		$page 			= intval($request->get_param('page'));

		if (!$genre_slug) {
				return new WP_Error('invalid_genre_slug', 'ジャンルスラッグが指定されていません。', array('status' => 400));
		}

		// 2) WP_Query 用の引数設定（taxonomy=genre で $genre_slug を絞り込む）
		$args = array(
				'post_type' 		 => 'post',
				'posts_per_page' => $per_page,
				'paged' 				 => $page,
				'tax_query' 		 => array(
						array(
								'taxonomy' => 'genre',
								'field' 	 => 'slug',
								'terms' 	 => $genre_slug,
						),
				),
				'orderby' => 'date',
				'order' 	=> 'DESC',
		);

		$query = new WP_Query($args);
		$posts = array();

		if ($query->have_posts()) {
				foreach ($query->posts as $post) {
						$post_id = $post->ID;

						// --------------------------------------------
						// カテゴリー情報 (アーティスト情報)
						// 既存コード: get_field('artistjpname', 'category_{term_id}') を使う形
						// 修正: the_prefix をタクソノミーメタから取得
						// --------------------------------------------
						$category_terms = wp_get_post_terms($post_id, 'category', array('fields' => 'all'));
						$categories = array_map(function ($term) {
								// ★ the_prefix を term_meta から読み込み:
								//		例: '1' なら SongList 側で "The " を付ける
								$the_prefix_val = get_term_meta($term->term_id, 'the_prefix', true);

								return array(
										'term_id' 		 => $term->term_id,
										'name'				 => $term->name,
										'slug'				 => $term->slug,
										'artistjpname' => get_field('artistjpname', 'category_' . $term->term_id) ?: null,
										'artistorigin' => get_field('artistorigin', 'category_' . $term->term_id) ?: 'Unknown',

										// ここで the_prefix を JSON に含める
										'the_prefix'	 => ($the_prefix_val === '1') ? '1' : null,
								);
						}, $category_terms);

						// ジャンル情報
						$genre_terms = wp_get_post_terms($post_id, 'genre', array('fields' => 'all'));
						$genres = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $genre_terms);

						// スタイル情報
						$style_terms = wp_get_post_terms($post_id, 'style', array('fields' => 'all'));
						$styles = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $style_terms);

						// ボーカル情報
						$vocal_terms = wp_get_post_terms($post_id, 'vocal', array('fields' => 'all'));
						$vocals = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $vocal_terms);

						// 必要なデータを収集
						$posts[] = array(
								'id'								=> $post_id,
								'date'							=> $post->post_date,
								'slug'							=> $post->post_name,
								'title' => array(
										'rendered' => $post->post_title,
								),
								'content' => array(
										'rendered' => $post->post_content,
								),
								'featured_media_url' => get_the_post_thumbnail_url($post_id, 'full'),

								// 各タクソノミーごとの配列
								'categories' => $categories,	// ← the_prefix を含む
								'genre' 		 => $genres,
								'style' 		 => $styles,
								'vocal_data' => $vocals,

								// ACF 情報 (投稿単位)
								'acf' => array(
										'ytvideoid' 					 => get_field('ytvideoid', $post_id),
										'spotify_track_id'		 => get_field('spotify_track_id', $post_id),
										'spotify_artists' 		 => get_field('spotify_artists', $post_id),
										'spotify_name'				 => get_field('spotify_name', $post_id),
										'spotify_images'			 => get_field('spotify_images', $post_id),
										'artist_order'				 => get_field('artist_order', $post_id),
										'likecount' 					 => get_field('likecount', $post_id) ?: null,
										'pvstyle' 						 => get_field('pvstyle', $post_id),
										'spotify_release_date' => get_field('spotify_release_date', $post_id),
								),
						);
				}
				wp_reset_postdata();
		}

		// プレイリスト情報 (不要なら削除)
		$playlists = array();
		$playlist_query = new WP_Query(array(
				'post_type' 		 => 'playlist',
				'posts_per_page' => -1,
				'fields'				 => 'ids', // IDsのみ取得
		));
		if ($playlist_query->have_posts()) {
				foreach ($playlist_query->posts as $playlist_id) {
						$playlists[] = array(
								'title' => get_the_title($playlist_id),
								'slug'	=> get_post_field('post_name', $playlist_id),
								'count' => wp_count_posts('playlist')->publish,
						);
				}
		}

		// 総数やページ数
		$response = array(
				'posts' 				=> $posts,
				'playlists' 		=> $playlists,
				'total' 				=> (int) $query->found_posts,
				'max_num_pages' => (int) $query->max_num_pages,
		);

		// フロントで X-WP-Total, X-WP-TotalPages 読みたい場合
		header('X-WP-Total: ' . $query->found_posts);
		header('X-WP-TotalPages: ' . $query->max_num_pages);

		return rest_ensure_response($response);
}




add_action('rest_api_init', function () {
		register_rest_route('custom/v1', '/genre-songlist', array(
				'methods'  => 'GET',
				'callback' => 'get_genre_songlist_data_by_slug',
				'args'		 => array(
						'genre_slug' => array(
								'required' => true,
								'validate_callback' => function ($param) {
										return is_string($param) && !empty($param);
								},
						),
						'per_page' => array(
								'required' => false,
								'default'  => 20,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
						'page' => array(
								'required' => false,
								'default'  => 1,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
				),
				'permission_callback' => '__return_true',
		));
});















/**
 * アーティストの投稿一覧を取得するカスタムエンドポイント
 */
/**
 * アーティストの投稿一覧を取得するカスタムエンドポイント
 * Endpoint: /wp-json/custom/v1/artist-songlist?category_id=XX&per_page=...&page=...
 */
function get_artist_songlist($request) {
		$category_id = intval($request->get_param('category_id'));
		$per_page = intval($request->get_param('per_page'));
		$page = intval($request->get_param('page'));

		if (!$category_id) {
				return new WP_Error('invalid_category', 'カテゴリーIDが指定されていません。', array('status' => 400));
		}

		// 投稿データのクエリ設定
		$args = array(
				'post_type' 		 => 'post',
				'posts_per_page' => $per_page,
				'paged' 				 => $page,
				'tax_query' => array(
						array(
								'taxonomy' => 'category',
								'field' 	 => 'term_id',
								'terms' 	 => $category_id,
						),
				),
				'orderby' => 'date',
				'order' 	=> 'DESC',
		);

		$query = new WP_Query($args);
		$posts = array();

		if ($query->have_posts()) {
				foreach ($query->posts as $post) {
						$post_id = $post->ID;

						// ================================
						// カテゴリー情報 (アーティスト)
						// ================================
						$category_terms = wp_get_post_terms($post_id, 'category', array('fields' => 'all'));
						$categories = array_map(function ($term) {
								// ★ ここで the_prefix を term_meta から取得
								//		"the_prefix" が '1' なら後でフロント側で "The " を付ける
								$the_prefix_val = get_term_meta($term->term_id, 'the_prefix', true);

								return array(
										'term_id' 			=> $term->term_id,
										'name'					=> $term->name,
										'slug'					=> $term->slug,
										'artistjpname'	=> get_field('artistjpname', 'category_' . $term->term_id) ?: null,
										'artistorigin'	=> get_field('artistorigin', 'category_' . $term->term_id) ?: 'Unknown',
										'artistdied'		=> get_field('artistdied', 'category_' . $term->term_id) ?: null,
										'spotify_artist_images' => get_field('spotify_artist_images', 'category_' . $term->term_id) ?: null,

										// JSON に the_prefix を含める (null or '1')
										'the_prefix'		=> ($the_prefix_val === '1') ? '1' : null,
								);
						}, $category_terms);

						// ジャンル情報
						$genre_terms = wp_get_post_terms($post_id, 'genre', array('fields' => 'all'));
						$genres = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $genre_terms);

						// スタイル情報
						$style_terms = wp_get_post_terms($post_id, 'style', array('fields' => 'all'));
						$styles = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $style_terms);

						// ボーカル情報
						$vocal_terms = wp_get_post_terms($post_id, 'vocal', array('fields' => 'all'));
						$vocals = array_map(function ($term) {
								return array(
										'term_id' => $term->term_id,
										'name'		=> $term->name,
										'slug'		=> $term->slug,
								);
						}, $vocal_terms);

						// 必要なデータを収集
						$posts[] = array(
								'id'								=> $post->ID,
								'date'							=> $post->post_date,
								'slug'							=> $post->post_name,
								'title' => array(
										'rendered' => $post->post_title,
								),
								'content' => array(
										'rendered' => $post->post_content,
								),
								'featured_media_url' => get_the_post_thumbnail_url($post_id, 'full'),

								'categories' => $categories,	// the_prefix を含む
								'genre' 		 => $genres,
								'style' 		 => $styles,
								'vocal_data' => $vocals,

								'acf' => array(
										'ytvideoid' 					 => get_field('ytvideoid', $post_id),
										'spotify_track_id'		 => get_field('spotify_track_id', $post_id),
										'spotify_artists' 		 => get_field('spotify_artists', $post_id),
										'spotify_name'				 => get_field('spotify_name', $post_id),
										'spotify_images'			 => get_field('spotify_images', $post_id),
										'artist_order'				 => get_field('artist_order', $post_id),
										'likecount' 					 => get_field('likecount', $post_id) ?: null,
										'pvstyle' 						 => get_field('pvstyle', $post_id),
										'spotify_release_date' => get_field('spotify_release_date', $post_id),
								),
						);
				}
				wp_reset_postdata();
		}

		return rest_ensure_response(array(
				'posts' => $posts,
				'total' => (int) $query->found_posts,
				'max_num_pages' => (int) $query->max_num_pages,
		));
}

// REST API にカスタムエンドポイントを登録
add_action('rest_api_init', function () {
		register_rest_route('custom/v1', '/artist-songlist', array(
				'methods'  => 'GET',
				'callback' => 'get_artist_songlist',
				'args' => array(
						'category_id' => array(
								'required' => true,
								'validate_callback' => function ($param) {
										return is_numeric($param);
								},
						),
						'per_page' => array(
								'required' => false,
								'default' => 20,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
						'page' => array(
								'required' => false,
								'default' => 1,
								'validate_callback' => function ($param) {
										return is_numeric($param) && $param > 0;
								},
						),
				),
				'permission_callback' => '__return_true',
		));
});

















// カスタムエンドポイント「/wp-json/custom/v1/fast-tags」を登録
add_action('rest_api_init', function () {
		register_rest_route('custom/v1', '/fast-tags', [
				'methods'  => 'GET',
				'callback' => 'get_fast_tags_songlist_format',
		]);
});

function get_fast_tags_songlist_format(WP_REST_Request $request) {
		// クエリパラメータから件数、ページ、タグフィルタを取得
		$posts_per_page = $request->get_param('per_page') ? intval($request->get_param('per_page')) : 10;
		$page = $request->get_param('page') ? intval($request->get_param('page')) : 1;
		$args = [
				'post_type' 		 => 'post',
				'posts_per_page' => $posts_per_page,
				'paged' 				 => $page,
		];
		if ($tag = $request->get_param('tag')) {
				$args['tag__in'] = [intval($tag)];
		}

		$query = new WP_Query($args);
		// ヘッダーに総件数をセット（フロント側のページネーション用）
		header('x-wp-total: ' . $query->found_posts);

		$posts = [];

		// 変換用ヘルパー：日付整形
		function format_date_for_json($date) {
				$dt = new DateTime($date);
				return $dt ? $dt->format(DateTime::ATOM) : "";
		}

		// スタイルID→名前のマッピング（必要に応じ調整）
		$styleIdToNameMapping = [
				2845 => "Alternative",
				4686 => "Dance",
				2846 => "Electronica",
				2848 => "Hip-hop",
				2873 => "Others",
				2844 => "Pop",
				2847 => "R&B",
				2849 => "Rock",
				4687 => "Drum and Bass",
		];

		if ($query->have_posts()) {
				while ($query->have_posts()) {
						$query->the_post();
						$post_id = get_the_ID();

						// タイトル、コンテンツはオブジェクト形式で返す
						$title_obj	 = [ 'rendered' => get_the_title() ];
						$content_obj = [ 'rendered' => apply_filters('the_content', get_the_content()) ];

						// ① カスタムフィールド 'categories'（アーティスト情報）を取得
						$artist_meta = get_post_meta($post_id, 'categories', true);
						$categories_arr = [];
						if (!empty($artist_meta) && is_array($artist_meta)) {
								// カスタムフィールドにアーティスト情報がある場合
								$categories_arr = array_map(function($item) {
										$origin = !empty($item['artistorigin']) ? $item['artistorigin'] : 'Unknown';
										return [
												'name'				 => isset($item['name']) ? $item['name'] : "Unknown Artist",
												'slug'				 => isset($item['slug']) ? $item['slug'] : "unknown-artist",
												'artistorigin' => $origin,
												'the_prefix'	 => !empty($item['the_prefix']) ? $item['the_prefix'] : '',
										];
								}, $artist_meta);
						} else {
								// ② カスタムフィールドがない場合は通常のカテゴリタクソノミーから取得
								$artist_terms = get_the_terms($post_id, 'category');
								if (!empty($artist_terms) && !is_wp_error($artist_terms)) {
										$categories_arr = array_map(function($term) {
												// termメタから国籍を取得 (必要に応じてメタキーを修正)
												$origin = get_term_meta($term->term_id, 'artistorigin', true);
												if (!$origin) {
														$origin = 'Unknown';
												}
												return [
														'name'				 => $term->name,
														'slug'				 => $term->slug,
														'artistorigin' => $origin,
														'the_prefix'	 => '',
												];
										}, $artist_terms);
								}
						}

						// ジャンル情報
						$genre_terms = get_the_terms($post_id, 'genre');
						$genre_arr = [];
						if (!empty($genre_terms) && !is_wp_error($genre_terms)) {
								$genre_arr = array_map(function($term) {
										return [
												'name' => $term->name,
												'slug' => $term->slug,
										];
								}, $genre_terms);
						}

						// ボーカル情報
						$vocal_terms = get_the_terms($post_id, 'vocal');
						$vocal_arr = [];
						if (!empty($vocal_terms) && !is_wp_error($vocal_terms)) {
								$vocal_arr = array_map(function($term) {
										return [
												'name' => $term->name,
												'slug' => $term->slug,
										];
								}, $vocal_terms);
						}

						// スタイル情報
						$style_terms = get_the_terms($post_id, 'style');
						$style_arr = [];
						if (!empty($style_terms) && !is_wp_error($style_terms)) {
								$style_arr = array_map(function($term) {
										return [
												'term_id' => $term->term_id,
												'name'		=> $term->name,
												'slug'		=> $term->slug,
										];
								}, $style_terms);
						} else {
								// fast-tags では style が数値配列の場合もあるので、fallback
								$raw_style = get_post_meta($post_id, 'style', true);
								if (!empty($raw_style)) {
										$raw_style = is_array($raw_style) ? $raw_style : [$raw_style];
										$style_arr = array_map(function($sid) use ($styleIdToNameMapping) {
												$name = isset($styleIdToNameMapping[$sid]) ? $styleIdToNameMapping[$sid] : "Unknown Style";
												return [
														'term_id' => $sid,
														'name'		=> $name,
														'slug'		=> strtolower(str_replace(" ", "-", $name)),
												];
										}, $raw_style);
								}
						}

						// ACF フィールド
						$acf_obj = [
								'ytvideoid' 			 => get_field('ytvideoid', $post_id),
								'spotify_track_id' => get_field('spotify_track_id', $post_id),
								'spotify_artists'  => get_field('spotify_artists', $post_id),
								'artist_order'		 => get_field('artist_order', $post_id),
						];

						// サムネイル
						$featured_media_url = get_the_post_thumbnail_url($post_id, 'full') ?: "";

						$posts[] = [
								'id'				 => $post_id,
								'date'			 => format_date_for_json(get_the_date('c')),
								'slug'			 => get_post_field('post_name', $post_id),
								'title' 		 => $title_obj,
								'content' 	 => $content_obj,
								'categories' => $categories_arr,	// SongList で determineArtistOrder() に使う
								'genre' 		 => $genre_arr,
								'vocal_data' => $vocal_arr,
								'style' 		 => $style_arr,
								'acf' 			 => $acf_obj,
								'featured_media_url' => $featured_media_url,
								'formattedDate' 		 => format_date_for_json(get_the_date('c')),
						];
				}
				wp_reset_postdata();
		}

		return rest_ensure_response($posts);
}





// functions.php などに追加 20240220

// カスタムエンドポイントを登録
function custom_playlist_songs_endpoint() {
		register_rest_route('custom/v1', '/playlist-songs', array(
				'methods' 						=> 'GET',
				'callback'						=> 'get_playlist_songs_data',
				'permission_callback' => '__return_true', // 開発中は全ユーザーアクセス許可（本番では適切な権限チェックを）
		));
}
add_action('rest_api_init', 'custom_playlist_songs_endpoint');


/**
 * アーチスト情報（カテゴリー）のデータを取得する
 *
 * 1. まず、カスタムフィールド custom_fields.categories があればそれを使用し、
 *		なければ taxonomy "category" から取得する。
 * 2. その後、対象投稿の ACF フィールド 'artist_order' が空の場合、かつ
 *		'spotify_artists' が設定されていれば、Spotify の順序に従って並び替える。
 */
function get_artist_data( $post_id ) {
		// 優先：カスタムフィールド custom_fields.categories
		$custom = get_post_meta( $post_id, 'custom_fields', true );
		if ( !empty($custom) && isset($custom['categories']) && !empty($custom['categories']) ) {
				$artist_data = $custom['categories'];
		} else {
				// taxonomy "category" から取得
				$terms = get_the_terms( $post_id, 'category' );
				if ( empty( $terms ) || is_wp_error( $terms ) ) {
						return array();
				}
				$artist_data = array();
				foreach ( $terms as $term ) {
						// タームメタから直接取得（ACF を利用している場合は get_term_meta() で取得する）
						$artistorigin = get_term_meta( $term->term_id, 'artistorigin', true );
						$artist_data[] = array(
								'id'	 => $term->term_id,
								'name' => $term->name,
								'slug' => $term->slug,
								'acf'  => array(
										'artistorigin' => $artistorigin ? $artistorigin : '',
										'prefix'			 => '', // 必要に応じて設定
								),
						);
				}
		}

		// 並び替え処理
		$acf_fields = get_fields( $post_id );
		if ( empty($acf_fields['artist_order']) && !empty($acf_fields['spotify_artists']) ) {
				// spotify_artists はカンマ区切りの文字列
				$spotify_order = array_map('trim', explode(',', $acf_fields['spotify_artists']));
				$ordered = array();
				// Spotify の順序に合わせ、artist_data から一致するものを抽出
				foreach ( $spotify_order as $name ) {
						foreach ( $artist_data as $artist ) {
								if ( strtolower(trim($artist['name'])) === strtolower($name) ) {
										$ordered[] = $artist;
										break;
								}
						}
				}
				// 足りない分は後ろに追加
				if ( count($ordered) < count($artist_data) ) {
						foreach ( $artist_data as $artist ) {
								$found = false;
								foreach ( $ordered as $ord ) {
										if ( $ord['id'] === $artist['id'] ) {
												$found = true;
												break;
										}
								}
								if ( ! $found ) {
										$ordered[] = $artist;
								}
						}
				}
				$artist_data = $ordered;
		}
		return $artist_data;
}

/**
 * カスタムエンドポイントのコールバック：プレイリスト用曲情報を取得する
 */
function get_playlist_songs_data( $request ) {
		$include = $request->get_param('include');
		$args = array(
				'post_type' 		 => 'post',
				'posts_per_page' => -1,
		);
		if ( $include ) {
				// カンマ区切りの数値文字列を数値配列に変換
				$ids = array_map('intval', explode(',', $include));
				$args['post__in'] = $ids;
		}
		
		$query = new WP_Query( $args );
		$posts = $query->posts;
		$data = array();
		
		foreach ( $posts as $post ) {
				// ACF フィールドから必要なもののみ取得
				$acf_fields = get_fields( $post->ID );
				$acf_subset = array(
						'ytvideoid' 			 => isset($acf_fields['ytvideoid']) ? $acf_fields['ytvideoid'] : '',
						'likecount' 			 => isset($acf_fields['likecount']) ? $acf_fields['likecount'] : '',
						'artist_order'		 => isset($acf_fields['artist_order']) ? $acf_fields['artist_order'] : '',
						'spotify_track_id' => isset($acf_fields['spotify_track_id']) ? $acf_fields['spotify_track_id'] : '',
						'spotify_artists'  => isset($acf_fields['spotify_artists']) ? $acf_fields['spotify_artists'] : '',
				);
				
				// style taxonomy を取得し、term_id の配列として返す
				$style_terms = get_the_terms( $post->ID, 'style' );
				if ( !empty( $style_terms ) && ! is_wp_error( $style_terms ) ) {
						$style = array_map(function($term) {
								return $term->term_id;
						}, $style_terms);
				} else {
						$style = array();
				}
				
				// アーティスト情報を取得（ここで並び替えも行われる）
				$artist_data = get_artist_data( $post->ID );
				
				// detail_link を、並び替え後の最初のアーチストのスラッグから生成
				$detail_link = '';
				if ( !empty($artist_data) ) {
						$detail_link = '/' . $artist_data[0]['slug'] . '/song/' . $post->post_name . '/';
				}
				
				// genre_data：各 term から name と slug のみを返す
				$genre_terms = get_the_terms( $post->ID, 'genre' );
				if ( !empty( $genre_terms ) && ! is_wp_error( $genre_terms ) ) {
						$genre_data = array_map(function($term) {
								return array(
										'name' => $term->name,
										'slug' => $term->slug,
								);
						}, $genre_terms);
				} else {
						$genre_data = array();
				}
				
				// vocal_data：name のみを返す
				$vocal_terms = get_the_terms( $post->ID, 'vocal' );
				if ( !empty( $vocal_terms ) && ! is_wp_error( $vocal_terms ) ) {
						$vocal_data = array_map(function($term) {
								return array(
										'name' => $term->name,
								);
						}, $vocal_terms);
				} else {
						$vocal_data = array();
				}
				
				$data[] = array(
						'id'									=> $post->ID,
						'date'								=> $post->post_date,
						'slug'								=> $post->post_name,
						'title' 							=> array( 'rendered' => get_the_title( $post->ID ) ),
						'content' 						=> array( 'rendered' => apply_filters('the_content', $post->post_content) ),
						'style' 							=> $style,
						'acf' 								=> $acf_subset,
						'featured_media_url'	=> wp_get_attachment_url( get_post_thumbnail_id( $post->ID ) ),
						'custom_fields' 			=> array(
								'categories' => $artist_data,
						),
						'detail_link' 				=> $detail_link,
						'genre_data'					=> $genre_data,
						'vocal_data'					=> $vocal_data,
				);
		}
		return rest_ensure_response( $data );
}
add_action('rest_api_init', 'custom_playlist_songs_endpoint');




// ジャンルタクソノミーJSON生成 20250309
// ジャンルタクソノミーの変更時に静的 JSON を再生成する関数
function generate_genres_json() {
		$taxonomy = 'genre'; // カスタムタクソノミーのスラッグ
		// タクソノミーの全タームを取得（空でも取得する）
		$terms = get_terms( array(
				'taxonomy'	 => $taxonomy,
				'hide_empty' => false,
		) );
		
		if ( is_wp_error( $terms ) ) {
				return;
		}
		
		$data = array();
		// タームごとに必要な情報を配列に格納
		foreach ( $terms as $term ) {
				$data[$term->name] = array(
						'id'	 => $term->term_id,
						'slug' => $term->slug,
				);
		}
		
		// アップロードディレクトリに genres.json を出力
		$upload_dir = wp_upload_dir();
		$file = trailingslashit( $upload_dir['basedir'] ) . 'genres.json';
		
		// JSON_PRETTY_PRINT で整形、JSON_UNESCAPED_UNICODE で日本語等もそのまま出力
		file_put_contents( $file, wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) );
}

// タクソノミー「genre」のタームが作成、更新、削除されたときに JSON を再生成
function regenerate_genres_json_on_term_change( $term_id, $tt_id, $taxonomy ) {
		if ( 'genre' === $taxonomy ) {
				generate_genres_json();
		}
}
add_action( 'created_term', 'regenerate_genres_json_on_term_change', 10, 3 );
add_action( 'edited_term',	'regenerate_genres_json_on_term_change', 10, 3 );
add_action( 'delete_term',	'regenerate_genres_json_on_term_change', 10, 3 );





function allow_acf_update_permissions($permission, $request, $post) {
		// 管理者なら常に更新を許可
		if ( current_user_can('administrator') ) {
				return true;
		}
		return $permission;
}
add_filter('acf/rest_api/update_item_permissions', 'allow_acf_update_permissions', 10, 3);


// カスタム REST API 登録（安全バージョン）
add_action('rest_api_init', function () {
	register_rest_route('custom/v1', '/songlist', array(
		'methods' 						=> 'GET',
		'callback'						=> 'my_custom_songlist_callback',
		'permission_callback' => '__return_true', // ← これが必須
	));

	register_rest_route('my_custom_namespace/v1', '/artist-count/(?P<alphabet>[a-zA-Z])', array(
		'methods' 						=> 'GET',
		'callback'						=> 'my_custom_artist_count_callback',
		'permission_callback' => '__return_true', // ← これも必須！
	));
});


function my_custom_songlist_callback($request) {
	return new WP_REST_Response(['message' => 'songlist ok'], 200);
}

function my_custom_artist_count_callback($request) {
	return new WP_REST_Response(['message' => 'artist count ok'], 200);
}


// soundtrackタクソノミーをREST APIに追加
function register_soundtrack_taxonomy_rest_field() {
		register_rest_field(
				'post',
				'soundtrack',
				array(
						'get_callback' => function($post) {
								$terms = wp_get_post_terms($post['id'], 'soundtrack', array('fields' => 'all'));
								return array_map(function($term) {
										return array(
												'id' => $term->term_id,
												'name' => $term->name,
												'slug' => $term->slug
										);
								}, $terms);
						},
						'update_callback' => null,
						'schema' => null,
				)
		);
}
add_action('rest_api_init', 'register_soundtrack_taxonomy_rest_field');







/**
 * 投稿一覧画面のスクリーンオプションにスタイルを追加する
 */
function add_style_column_to_posts_screen() {
		// 現在の画面が投稿一覧ページであることを確認
		$screen = get_current_screen();
		if ($screen->id !== 'edit-post') {
				return;
		}
		
		// カスタムカラムを追加
		add_filter('manage_posts_columns', 'add_style_column_to_posts');
		add_action('manage_posts_custom_column', 'display_style_column_content', 10, 2);
		add_filter('manage_edit-post_sortable_columns', 'make_style_column_sortable');
}
add_action('current_screen', 'add_style_column_to_posts_screen');

/**
 * 投稿一覧に「Style」カラムを追加
 */
function add_style_column_to_posts($columns) {
		// 新しいカラム配列を作成
		$new_columns = array();
		
		// カラムの順序を調整（カテゴリーの後に配置）
		foreach ($columns as $key => $value) {
				$new_columns[$key] = $value;
				if ($key === 'categories') {
						$new_columns['style'] = 'Style';
				}
		}
		
		// カテゴリーがない場合は投稿者の後に追加
		if (!isset($new_columns['style'])) {
				$new_columns['style'] = 'Style';
		}
		
		return $new_columns;
}

/**
 * 「Style」カラムの内容を表示
 */
function display_style_column_content($column, $post_id) {
		if ($column !== 'style') {
				return;
		}
		
		$terms = get_the_terms($post_id, 'style');
		if (empty($terms) || is_wp_error($terms)) {
				echo '—';
				return;
		}
		
		$style_links = array();
		foreach ($terms as $term) {
				$style_links[] = sprintf(
						'<a href="%s">%s</a>',
						esc_url(add_query_arg(array('post_type' => 'post', 'style' => $term->slug), 'edit.php')),
						esc_html($term->name)
				);
		}
		echo implode(', ', $style_links);
}

/**
 * 「Style」カラムをソート可能にする
 */
function make_style_column_sortable($columns) {
		$columns['style'] = 'style';
		return $columns;
}

/**
 * スクリーンオプションにStyleタクソノミーを表示させる
 */
function add_style_to_screen_options() {
		// スクリーンオプションにカスタムフィールドを追加
		add_filter('hidden_columns', 'show_style_column_by_default', 10, 3);
}
add_action('admin_init', 'add_style_to_screen_options');

/**
 * デフォルトでスタイルカラムを表示する
 */
function show_style_column_by_default($hidden, $screen, $use_defaults) {
		if ($screen->id === 'edit-post') {
				$key = array_search('style', $hidden);
				if ($key !== false) {
						unset($hidden[$key]);
				}
		}
		return $hidden;
}