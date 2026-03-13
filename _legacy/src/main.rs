use gpui::{
    div, prelude::*, px, rgb, size, App, Application, Bounds, Context, SharedString, Window,
    WindowBounds, WindowOptions,
};

// MnM - Product/Workflow focused Agentic Development Environment

struct HelloWorld {
    text: SharedString,
}

impl Render for HelloWorld {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .gap_3()
            .bg(rgb(0x0a0a1a)) // Deep space background
            .size(px(800.0))
            .justify_center()
            .items_center()
            .shadow_lg()
            .border_1()
            .border_color(rgb(0x2a2a4a))
            .text_xl()
            .text_color(rgb(0xffffff))
            .child(format!("✨ {}", &self.text))
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0x888888))
                    .child("Product-First Agentic Development Environment")
            )
            .child(
                div()
                    .flex()
                    .gap_2()
                    .mt_4()
                    .child(div().size_8().bg(rgb(0x4488ff)).rounded_full()) // Main
                    .child(div().size_8().bg(rgb(0x44ff88)).rounded_full()) // Hephaestos
                    .child(div().size_8().bg(rgb(0xff8844)).rounded_full()) // Atlas
                    .child(div().size_8().bg(rgb(0xff44ff)).rounded_full()) // Hygieia
                    .child(div().size_8().bg(rgb(0xffff44)).rounded_full()) // Daedalus
            )
            .child(
                div()
                    .text_xs()
                    .text_color(rgb(0x666666))
                    .mt_4()
                    .child("Powered by GPUI • Rust • Pantheon")
            )
    }
}

fn main() {
    Application::new().run(|cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(800.), px(600.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            |_, cx| {
                cx.new(|_| HelloWorld {
                    text: "MnM".into(),
                })
            },
        )
        .unwrap();
    });
}
