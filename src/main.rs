use gpui::*;

// MnM - Product/Workflow focused Agentic Development Environment
// 
// Core concepts:
// - Workflows (PRD → Stories → Code → Deploy)
// - Agents (specialized workers)
// - Context (specs, code, tests — always in sync)
// - Spec Drift Detection

struct MnmApp;

impl Render for MnmApp {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .size_full()
            .bg(rgb(0x0a0a1a)) // Deep space background
            .text_color(rgb(0xe0e0e0))
            .child(
                // Header
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .p_4()
                    .border_b_1()
                    .border_color(rgb(0x2a2a4a))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child("✨")
                            .child(
                                div()
                                    .text_xl()
                                    .font_weight(FontWeight::BOLD)
                                    .child("MnM")
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0x888888))
                                    .child("Product-First ADE")
                            )
                    )
            )
            .child(
                // Main content
                div()
                    .flex()
                    .flex_1()
                    .child(
                        // Sidebar - Workflow stages
                        div()
                            .w(px(250.))
                            .border_r_1()
                            .border_color(rgb(0x2a2a4a))
                            .p_4()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(rgb(0x888888))
                                    .mb_4()
                                    .child("WORKFLOW")
                            )
                            .child(workflow_item("📋", "PRD", true))
                            .child(workflow_item("📖", "Stories", false))
                            .child(workflow_item("🏛️", "Architecture", false))
                            .child(workflow_item("💻", "Development", false))
                            .child(workflow_item("🧪", "Testing", false))
                            .child(workflow_item("🚀", "Deploy", false))
                    )
                    .child(
                        // Center - Context view
                        div()
                            .flex_1()
                            .p_6()
                            .child(
                                div()
                                    .text_2xl()
                                    .font_weight(FontWeight::BOLD)
                                    .mb_4()
                                    .child("Context Sync")
                            )
                            .child(
                                div()
                                    .p_4()
                                    .rounded_lg()
                                    .bg(rgb(0x1a1a2e))
                                    .border_1()
                                    .border_color(rgb(0x3a3a5a))
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(rgb(0x88ff88))
                                            .child("✅ PRD ↔ Code: In sync")
                                    )
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(rgb(0xffaa00))
                                            .mt_2()
                                            .child("⚠️ Story #3 → Tests: 2 uncovered acceptance criteria")
                                    )
                            )
                    )
                    .child(
                        // Right panel - Agents
                        div()
                            .w(px(280.))
                            .border_l_1()
                            .border_color(rgb(0x2a2a4a))
                            .p_4()
                            .child(
                                div()
                                    .text_sm()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_color(rgb(0x888888))
                                    .mb_4()
                                    .child("AGENTS")
                            )
                            .child(agent_card("🧠", "Main", "Orchestrating", true))
                            .child(agent_card("🔍", "Atlas", "Idle", false))
                            .child(agent_card("🔨", "Héphaestos", "Coding Story #2", true))
                            .child(agent_card("🧪", "Hygieia", "Idle", false))
                    )
            )
            .child(
                // Status bar
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .px_4()
                    .py_2()
                    .bg(rgb(0x0f0f1f))
                    .text_xs()
                    .text_color(rgb(0x666666))
                    .child("MnM v0.1.0 • Product-First ADE")
                    .child("Sprint 3 • 4 stories remaining")
            )
    }
}

fn workflow_item(icon: &'static str, label: &'static str, active: bool) -> Div {
    let bg = if active { rgb(0x2a2a4a) } else { rgb(0x0a0a1a) };
    let text_color = if active { rgb(0xffffff) } else { rgb(0x888888) };
    
    div()
        .flex()
        .items_center()
        .gap_2()
        .px_3()
        .py_2()
        .rounded_md()
        .bg(bg)
        .text_color(text_color)
        .cursor_pointer()
        .mb_1()
        .child(icon)
        .child(label)
}

fn agent_card(emoji: &'static str, name: &'static str, status: &'static str, active: bool) -> Div {
    let border_color = if active { rgb(0x44ff44) } else { rgb(0x2a2a4a) };
    
    div()
        .p_3()
        .mb_2()
        .rounded_lg()
        .bg(rgb(0x1a1a2e))
        .border_1()
        .border_color(border_color)
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                .child(emoji)
                .child(
                    div()
                        .font_weight(FontWeight::SEMIBOLD)
                        .child(name)
                )
        )
        .child(
            div()
                .text_xs()
                .text_color(rgb(0x888888))
                .mt_1()
                .child(status)
        )
}

fn main() {
    env_logger::init();
    
    Application::new()
        .run(|cx: &mut App| {
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(Bounds {
                        origin: Point::default(),
                        size: Size {
                            width: px(1400.),
                            height: px(900.),
                        },
                    })),
                    titlebar: Some(TitlebarOptions {
                        title: Some("MnM — Product-First ADE".into()),
                        appears_transparent: true,
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                |_window, cx| {
                    cx.new(|_cx| MnmApp)
                },
            )
            .unwrap();
        });
}
