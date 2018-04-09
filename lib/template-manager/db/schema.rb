# encoding: UTF-8
# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20171019010544) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "followed_objects", force: :cascade do |t|
    t.integer "user_id"
    t.integer "object_id"
    t.string  "object_type"
  end

  create_table "function_dependencies", force: :cascade do |t|
    t.integer "function_id"
    t.integer "used_function_id"
    t.integer "origin_tag_id"
  end

  create_table "functions", force: :cascade do |t|
    t.boolean  "is_deleted",  default: false, null: false
    t.integer  "user_id"
    t.string   "name"
    t.text     "blurb"
    t.string   "sig_key"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "sig"
    t.text     "body"
    t.string   "tag_path"
    t.string   "render_sig"
    t.text     "render_body"
    t.integer  "next_index",  default: 1,     null: false
  end

  add_index "functions", ["is_deleted", "id"], name: "index_functions_on_is_deleted_and_id", using: :btree
  add_index "functions", ["is_deleted", "sig_key"], name: "index_functions_on_is_deleted_and_sig_key", using: :btree

  create_table "functions_tags", force: :cascade do |t|
    t.integer "function_id"
    t.integer "tag_id"
  end

  create_table "immutable_functions", force: :cascade do |t|
    t.integer  "function_id"
    t.integer  "index"
    t.datetime "deleted_at"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text     "blurb"
    t.text     "sig"
    t.text     "body"
    t.integer  "user_id"
    t.text     "bindings"
  end

  add_index "immutable_functions", ["deleted_at", "function_id", "index"], name: "immuts_on_del_and_function_id_and_index", using: :btree

  create_table "jobs", force: :cascade do |t|
    t.string   "server_type"
    t.text     "job_data"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "user_id"
    t.datetime "assigned_at"
    t.datetime "started_at"
    t.datetime "finished_at"
    t.string   "result"
    t.integer  "object_id"
    t.string   "object_type"
    t.integer  "progress",    default: 0, null: false
    t.integer  "max_seconds", default: 0, null: false
  end

  add_index "jobs", ["object_type", "object_id"], name: "index_jobs_on_object_type_and_object_id", using: :btree

  create_table "posted_objects", force: :cascade do |t|
    t.integer "post_id"
    t.integer "object_id"
    t.string  "object_type"
  end

  create_table "posts", force: :cascade do |t|
    t.boolean  "is_deleted",       default: false, null: false
    t.integer  "author_id"
    t.integer  "reply_to_post_id"
    t.text     "body"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "renders", force: :cascade do |t|
    t.integer  "immutable_function_id"
    t.boolean  "is_complete",           default: false, null: false
    t.text     "console_text"
    t.integer  "init_progress"
    t.integer  "render_progress"
    t.integer  "max_render_progress"
    t.integer  "lerp_progress"
    t.integer  "upload_progress"
    t.datetime "started_at"
    t.text     "params"
    t.string   "image3d_url"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "function_id"
    t.string   "stl_url"
  end

  add_index "renders", ["function_id"], name: "index_renders_on_function_id", using: :btree

  create_table "server_types", force: :cascade do |t|
    t.string   "server_type"
    t.integer  "version",                default: 1,     null: false
    t.binary   "zip"
    t.boolean  "out_of_date",            default: false, null: false
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "multicast_ip"
    t.integer  "multicast_port"
    t.string   "start_job_endpoint_url"
    t.string   "lambda_function_name"
  end

  create_table "servers", force: :cascade do |t|
    t.string   "server_type"
    t.string   "ip"
    t.integer  "port"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "job_id"
    t.datetime "fired_at"
  end

  add_index "servers", ["job_id"], name: "index_servers_on_job_id", unique: true, using: :btree
  add_index "servers", ["server_type", "job_id"], name: "index_servers_on_server_type_and_job_id", unique: true, using: :btree

  create_table "subtemplates", force: :cascade do |t|
    t.integer "template_id",     null: false
    t.string  "dom_field"
    t.string  "subtemplate_key"
    t.string  "model_view"
  end

  create_table "tag_of_objects", force: :cascade do |t|
    t.integer "tagged_object_id"
    t.integer "user_id"
  end

  create_table "tagged_objects", force: :cascade do |t|
    t.integer "tag_id"
    t.integer "object_id"
    t.string  "object_type"
    t.integer "tag_count"
    t.integer "object_sort_ordinal", default: 0
  end

  add_index "tagged_objects", ["tag_id", "object_type", "object_id"], name: "index_tagged_objects_on_tag_id_and_object_type_and_object_id", using: :btree

  create_table "tagging_objects", force: :cascade do |t|
    t.integer "tag_of_object_id"
    t.integer "object_id"
    t.string  "object_type"
  end

  create_table "tags", force: :cascade do |t|
    t.boolean  "is_deleted",             default: false, null: false
    t.boolean  "is_public",              default: true,  null: false
    t.integer  "user_id"
    t.string   "name"
    t.text     "blurb"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "tag_path"
    t.boolean  "is_top_level",           default: true
    t.integer  "top_level_sort_ordinal", default: 0
  end

  add_index "tags", ["is_deleted", "id"], name: "index_tags_on_is_deleted_and_id", using: :btree
  add_index "tags", ["is_deleted", "user_id"], name: "index_tags_on_is_deleted_and_user_id", using: :btree

  create_table "template_children", force: :cascade do |t|
    t.integer  "template_id"
    t.string   "dom_field"
    t.string   "model_field"
    t.text     "template_key"
    t.string   "class_filter"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean  "owner_only",   default: false, null: false
  end

  create_table "templates", force: :cascade do |t|
    t.string   "key"
    t.string   "class_filter"
    t.text     "dom"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.boolean  "owner_only",       default: false, null: false
    t.string   "name",                             null: false
    t.text     "displayed_fields"
  end

  add_index "templates", ["name"], name: "index_templates_on_name", using: :btree

  create_table "users", force: :cascade do |t|
    t.boolean  "is_deleted",             default: false, null: false
    t.text     "name"
    t.string   "authentication_token"
    t.string   "type"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "email",                  default: "",    null: false
    t.string   "encrypted_password",     default: "",    null: false
    t.string   "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer  "sign_in_count",          default: 0,     null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string   "current_sign_in_ip"
    t.string   "last_sign_in_ip"
    t.text     "bio"
    t.string   "tag_path"
    t.string   "username"
    t.string   "phoenix_token"
    t.string   "roles"
    t.integer  "max_render_seconds",     default: 60,    null: false
  end

  add_index "users", ["email"], name: "index_users_on_email", unique: true, using: :btree
  add_index "users", ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, using: :btree

end
